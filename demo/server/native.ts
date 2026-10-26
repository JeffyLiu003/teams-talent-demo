import { terminalPreferences } from './terminal-preferences.js';
import { createTerminalLauncher, findExecutable, formatShellCommand, posixQuote } from './terminal-launcher.js';
import { userSkillExamples } from '../src/project-skill-examples.js';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { access, readFile, mkdir, writeFile, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { binary, workspace, runtimeDir, sessionId, codeRoot, root, origin } from './config.js';
import { atomicJson, atomicText } from './store.js';
import type { DemoState } from '../src/domain.js';
const execute = promisify(execFile);
let verification: Record<string, unknown> | null = null;
let verifying: Promise<Record<string, unknown>> | undefined;
let launchBusy = false;
const launched = new Map<string, { identity: string; result: Promise<unknown> }>();
const terminalLauncher = createTerminalLauncher();
class AcpError extends Error { constructor(public method: string, public details: string, message: string) { super('ACP ' + method + ': ' + message); } }
export async function activeSession() {
  let owner: { session_id: string; pid: number };
  try { owner = JSON.parse(await readFile(join(homedir(), '.chrys/sessions/.locks/6b82c08deb3b.active.json'), 'utf8')); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw e; }
  if (owner.session_id !== sessionId || !Number.isSafeInteger(owner.pid) || owner.pid < 2) throw new Error('原生会话运行记录无效');
  try { process.kill(owner.pid, 0); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ESRCH') return null; throw e; }
  if (process.platform === 'win32') return { pid: owner.pid, application: null, tty: '' };
  let pid = owner.pid, application: string | null = null, tty = '';
  for (let depth = 0; depth < 8 && pid > 1; depth++) {
    const result = await execute('/bin/ps', ['-p', String(pid), '-o', 'ppid=', '-o', 'tty=', '-o', 'command='], { timeout: 5000 });
    const match = result.stdout.trim().match(/^(\d+)\s+(\S+)\s+(.+)$/);
    if (!match) throw new Error('无法核对原生会话进程');
    if (!depth) { tty = match[2]; if (!/chrys|icode/i.test(match[3])) throw new Error('会话运行记录与进程不符'); }
    if (match[3].includes('/Ghostty.app/')) { application = 'Ghostty'; break; }
    if (match[3].includes('/Terminal.app/')) { application = 'Terminal'; break; }
    if (match[3].includes('/iTerm.app/')) { application = 'iTerm'; break; }
    pid = Number(match[1]);
  }
  return { pid: owner.pid, application, tty };
}
export async function focusActive() {
  const active = await activeSession();
  if (!active?.application) throw new Error('没有可定位的桌面终端；请在原环境查看已运行会话');
  await execute('/usr/bin/open', ['-a', active.application], { timeout: 10000 });
  return { status: 'application-focused', application: active.application, pid: active.pid, note: '已打开持有该会话的终端应用，请在其中查看原会话。' };
}
export const shellQuote = posixQuote;
export async function installed(path: string) { try { await access(path, constants.X_OK); return true; } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false; throw e; } }
async function openCodePath() {
  return findExecutable(process.env.DEMO_OPENCODE_BINARY ?? 'opencode');
}
export async function toolsStatus() {
  const iCodeInstalled = await installed(binary), opencode = await openCodePath();
  const version = iCodeInstalled ? (await execute(binary, ['--version'], { timeout: 15000 })).stdout.trim() : null;
  const unsupportedReason = process.platform === 'win32' && opencode && !/\.exe$/i.test(opencode) ? '检测到 OpenCode .cmd/.bat；自动启动需设置 DEMO_OPENCODE_BINARY 为 opencode.exe 的绝对路径。' : undefined;
  const openVersion = opencode && !unsupportedReason ? (await execute(opencode, ['--version'], { timeout: 15000 })).stdout.trim() : null;
  const sessionPath = join(homedir(), '.chrys/sessions/6b82c08deb3b/session.json');
  let sessionAvailable = false;
  try { await access(sessionPath); sessionAvailable = true; } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  return { ...await terminalPreferences.context(), icode: { installed: iCodeInstalled, path: binary, version, workspace, sessionId, sessionAvailable, active: await activeSession() }, opencode: { installed: !!opencode && !unsupportedReason, path: opencode, version: openVersion, unsupportedReason }, verification };
}
async function verify(): Promise<Record<string, unknown>> {
  if (!await installed(binary)) throw new Error('配套 iCode 0.31.0 不存在');
  const child = spawn(binary, ['acp', '-C', workspace], { cwd: workspace, stdio: ['pipe', 'pipe', 'pipe'] });
  let seq = 0, buffer = '', total = 0, notifications = 0, diagnostics = '';
  const pending = new Map<number, { method: string; resolve: (data: any) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
  const fail = (error: Error) => { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(error); } pending.clear(); };
  child.on('error', fail);
  child.on('exit', () => fail(new Error('iCode ACP 进程已退出')));
  child.stderr.on('data', chunk => { diagnostics = (diagnostics + chunk.toString()).slice(-65536); });
  child.stdout.on('data', chunk => {
    total += chunk.length;
    if (total > 64 * 1024 * 1024) { fail(new Error('ACP 响应超出上限')); child.kill(); return; }
    buffer += chunk.toString();
    let newline: number;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
      if (!line.trim()) continue;
      try {
        const m = JSON.parse(line);
        if (m.id !== undefined && ('result' in m || 'error' in m)) {
          const p = pending.get(m.id); if (!p) continue;
          clearTimeout(p.timer); pending.delete(m.id);
          if (m.error) {
            diagnostics += '\n' + p.method + ': ' + JSON.stringify(m.error);
            p.reject(new AcpError(p.method, String(m.error.data?.details ?? ''), m.error.message));
          } else p.resolve(m.result);
        } else {
          notifications++;
          if (m.id !== undefined) child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: m.id, error: { code: -32601, message: 'Read-only session verification' } }) + '\n');
        }
      } catch (e) { fail(e as Error); }
    }
  });
  const request = (method: string, params: unknown): Promise<any> => new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(method + ' 超时')); }, 45000);
    pending.set(id, { method, resolve, reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  try {
    const initialized = await request('initialize', { protocolVersion: 1, clientCapabilities: {}, clientInfo: { name: 'teams-carddemo', version: '0.1.0' } });
    if (initialized.protocolVersion !== 1) throw new Error('iCode ACP 协议版本不匹配');
    const list = await request('session/list', { cwd: workspace });
    const found = list.sessions?.find((item: any) => item.sessionId === sessionId);
    if (!found) throw new Error('原生列表中没有找到恢复的历史会话');
    const history = await request('_session/history', { cwd: workspace, sessionId });
    if (!Array.isArray(history.messages) || !history.messages.length) throw new Error('历史会话内容为空');
    try { await request('session/load', { cwd: workspace, sessionId, mcpServers: [] }); }
    catch (error) {
      if (!(error instanceof AcpError) || error.method !== 'session/load' || !error.details.includes("Session '6b82c08deb3b' is already open in another iCode instance")) throw error;
      const active = await activeSession();
      if (!active) throw error;
      verification = { status: 'history-readable-active', at: new Date().toISOString(), agent: initialized.agentInfo, sessionId, cwd: workspace, messageCount: history.messages.length, active, methods: ['initialize', 'session/list', '_session/history'], load: 'blocked-by-existing-instance', note: '列表与历史读取成功；原会话正在其他实例运行，本次加载被原生锁拒绝。' };
      await atomicJson(join(runtimeDir, 'native-verification.json'), verification);
      return verification;
    }
    verification = { status: 'verified', at: new Date().toISOString(), agent: initialized.agentInfo, sessionId, cwd: workspace, messageCount: history.messages.length, notifications, methods: ['initialize', 'session/list', '_session/history', 'session/load'], note: '已真实读取并加载历史；没有发送开发指令或调用模型。' };
    await atomicJson(join(runtimeDir, 'native-verification.json'), verification);
    return verification;
  } catch (error) {
    await atomicJson(join(runtimeDir, 'native-error.json'), { at: new Date().toISOString(), error: (error as Error).message, diagnostics });
    throw error;
  } finally {
    for (const p of pending.values()) clearTimeout(p.timer);
    pending.clear(); child.stdin.end();
    if (child.exitCode === null) {
      await new Promise<void>(resolve => {
        const timer = setTimeout(() => { child.kill('SIGTERM'); resolve(); }, 3000);
        child.once('exit', () => { clearTimeout(timer); resolve(); });
      });
      if (child.exitCode === null) child.kill('SIGKILL');
    }
  }
}
export function verifySession() {
  if (!verifying) verifying = verify().finally(() => { verifying = undefined; });
  return verifying;
}
export async function foundationSkill() {
  const path = join(root, 'skills/teams-demo-collaboration/SKILL.md');
  const content = await readFile(path, 'utf8');
  const cli = formatShellCommand([process.execPath, join(root, 'scripts/teams-demo.mjs'), '--endpoint', origin]);
  return { path, content, cli, origin: 'demo-local-cli' };
}
export async function writeContext(state: DemoState) {
  if (!state.context) throw new Error('请先冻结项目上下文');
  const chosen=state.context.selectedSkills;
  const foundation=await foundationSkill();
  const path = join(runtimeDir, 'contexts', state.context.id + '-' + createHash('sha256').update(state.context.createdAt).digest('hex').slice(0, 12) + '-v3.md');
  const content = [
    '# 信用卡消费返现 · DEMO-MKT-001', '',
    '这是当前需求的上下文材料。当前项目代码包含存量营销实现，供理解现有系统；阅读与核对即可，不要重新执行部署、发送消息或修改全局配置。', '',
    '## 需求描述', '针对白金卡客户未来 3 个月的消费，额外增加 0.5% 的消费返现。', '',
    '## 已确认范围与待定事项', '已确认：白金卡客户、3 个月、额外返现 0.5%。具体日期、周期起算、消费范围、报名要求、门槛、上限及结算等其他规则待定。存量餐饮活动规则不作为本次需求条件。', '',
    '## 采用依据', JSON.stringify(state.context, null, 2), '',
    '## 本机资料', '项目：' + codeRoot, '需求设计：' + join(codeRoot, 'docs/design/08-marketing-capability.md'), '知识与设计：' + join(codeRoot, 'docs/design'), 'Skill：' + join(workspace, 'skills'), '',
    chosen.some(name=>userSkillExamples.some(skill=>skill.id===name)) ? '## 本次选用 Skill（项目与用户）' : '## 本次项目选用 Skill', ...chosen.map(name => { const example=userSkillExamples.find(skill=>skill.id===name);return example ? '- '+example.name+'（'+name+' · 用户 Skill，未核验本机安装）：'+example.content : '- ' + name + '：' + join(workspace, 'skills', name, 'SKILL.md'); }), '',
    '## 需求补充材料', ...state.context.materials.flatMap(m=>['### '+m.title,m.body,'']),
    '## Agent 基础协作', 'Teams 进度同步 Skill：'+foundation.path,'通过 Teams CLI 回传进度。业务 Skill 与该基础能力分别管理。','',
    '## 已知问题', '历史报名按钮问题已经修复；安全扫描证据缺失，ADR-007记录了鉴权范围限制。功能验收不代表生产放行。', '',
    '## 历史会话', sessionId, '', '上下文由 Teams 导出；提供文件不等于 iCode 已读取或已采用。'
  ].join('\n');
  await mkdir(join(runtimeDir, 'contexts'), { recursive: true });
  let previous: string | undefined;
  try { previous = await readFile(path, 'utf8'); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  if (previous !== undefined && previous !== content) throw new Error('已冻结上下文文件不同，请重置工作区后重新准备');
  if (previous === undefined) await atomicText(path, content);
  return { path, sha256: createHash('sha256').update(content).digest('hex'), content, prompt: '请读取并核对这份项目上下文，先不要修改代码：' + path };
}
export function launch(tool: 'icode' | 'opencode', restore: boolean, requestId: string, expectedTerminal?: string) {
  const identity = JSON.stringify({ tool, restore, expectedTerminal }), previous = launched.get(requestId);
  if (previous) { if (previous.identity !== identity) return Promise.reject(new Error('原启动请求标识已用于另一动作')); return previous.result; }
  if (launchBusy) return Promise.reject(new Error('启动请求正在执行'));
  launchBusy = true;
  const result = (async () => {
    const entry = tool === 'icode' ? binary : await openCodePath();
    if (!entry || !await installed(entry)) throw new Error(tool + ' 尚未安装');
    if (restore && tool !== 'icode') throw new Error('当前未提供 OpenCode 会话恢复');
    if (restore) {
      const history = JSON.parse(await readFile(join(homedir(), '.chrys/sessions/6b82c08deb3b/session.json'), 'utf8'));
      if (history.meta?.session_id !== sessionId || await realpath(history.meta.primary_cwd) !== await realpath(workspace)) throw new Error('历史会话与当前工作目录不匹配，请在原目录继续');
      const active = await activeSession();
      if (active) throw new Error('该历史会话正在 ' + (active.application ?? '另一实例') + ' 中运行，请在原窗口继续；未启动重复实例');
    }
    const args = tool === 'icode' ? ['-C', workspace, ...(restore ? ['--session', sessionId] : [])] : [workspace];
    const terminal = await terminalPreferences.selected(expectedTerminal);
    const launchedTerminal = await terminalLauncher.launch({ executable: entry, directory: workspace, args, terminal: terminal.id });
    const receipt = { requestId, tool, restore, at: new Date().toISOString(), ...launchedTerminal, sessionId: restore ? sessionId : null };
    await atomicJson(join(runtimeDir, 'last-launch.json'), receipt); return receipt;
  })().finally(() => { launchBusy = false; });
  // Retain failures too: an uncertain original request must never silently launch again.
  launched.set(requestId, { identity, result }); return result;
}

/** Native work entry: caller has validated and pinned the project directory/configuration. */
export async function nativeWorkDefaults() {
  if (!await installed(binary)) return null;
  const [agentReply, modelReply] = await Promise.all([
    execute(binary, ['agent', '--json'], { timeout: 10000, maxBuffer: 262144 }),
    execute(binary, ['model', '--json'], { timeout: 10000, maxBuffer: 262144 }),
  ]);
  const agents = JSON.parse(agentReply.stdout), models = JSON.parse(modelReply.stdout);
  if (!Array.isArray(agents.agents) || !Array.isArray(models.models)) throw new Error('iCode 默认配置响应无效');
  const role = agents.agents.find((agent: any) => agent.name === agents.default && agent.default === true);
  if (!role || role.launchableAsMain !== true || role.subAgentOnly) throw new Error('iCode 默认角色不能作为主会话启动');
  const selector = role.model === 'active' ? models.active : role.model;
  const matches = models.models.filter((model: any) => model.id === selector || model.name === selector);
  if (matches.length !== 1) throw new Error('iCode 默认角色的模型配置无效');
  const preference = await terminalPreferences.context();
  return { agent: role.id, agentLabel: role.displayName, model: matches[0].id, modelLabel: matches[0].name, terminal: { id: preference.selectedTerminal, name: preference.terminalName, error: preference.terminalError } };
}
export async function startNativeWork(input: { directory: string; agent: string; model: string; sessionId?: string; instruction: string; terminal: string }) {
  const args = ['-C', input.directory, '--agent', input.agent, '--model', input.model, ...(input.sessionId ? ['--session', input.sessionId] : [])];
  const terminal = await terminalPreferences.selected(input.terminal);
  return terminalLauncher.launch({ executable: binary, directory: input.directory, args, instruction: input.instruction, terminal: terminal.id });
}

/** Read-only terminal discovery. A title match is not an assertion that context was adopted. */
export async function locateWorkTerminal(active: NonNullable<Awaited<ReturnType<typeof activeSession>>>, title: string) {
  if (active.application !== 'Ghostty') return { diagnostic: '当前终端没有接入可核对的窗口定位；请在原终端继续，或显式新建独立会话。' };
  const script = 'on run argv\ntell application "Ghostty"\nset matches to {}\nrepeat with term in terminals\nif name of term is (item 1 of argv) then set end of matches to (id of term) & (ASCII character 9) & (working directory of term)\nend repeat\nset AppleScript\'s text item delimiters to linefeed\nreturn matches as text\nend tell\nend run';
  try {
    const rows = (await execute('/usr/bin/osascript', ['-e', script, title], { timeout: 5000 })).stdout.trim().split('\n').filter(Boolean);
    if (rows.length !== 1) return { diagnostic: '未找到唯一同标题的 Ghostty 终端，未自动选择其他窗口。' };
    const [id, directory] = rows[0].split('\t');
    if (!id || !directory) throw new Error('终端定位响应无效');
    return { terminal: { id, title, directory } };
  } catch (error) { return { diagnostic: '终端定位失败：' + (error as Error).message }; }
}
export async function focusWorkTerminal(history: NonNullable<import('../src/project-work.js').ProjectWorkPlan['history']>) {
  if (process.env.DEMO_NATIVE_DISABLED === '1') throw new Error('此验证实例未开放真实会话进入');
  const active = await activeSession();
  if (!active || active.pid !== history.active?.pid || !history.active.terminal) throw new Error('原会话运行状态已变化，请重新核对');
  const found = await locateWorkTerminal(active, history.title);
  if (!found.terminal || found.terminal.id !== history.active.terminal.id) throw new Error('历史会话终端已变化，未切换到其他窗口');
  const script = 'on run argv\ntell application "Ghostty"\nset term to first terminal whose id is (item 1 of argv)\nif name of term is not (item 2 of argv) then error "Terminal title changed"\nfocus term\nend tell\nend run';
  await execute('/usr/bin/osascript', ['-e', script, found.terminal.id, history.title], { timeout: 10000 });
  return { status: 'terminal-focused', note: '已定位并进入 Ghostty 中的「' + history.title + '」终端。未向运行中的会话发送输入；请显式读取本次工作入口。' };
}
