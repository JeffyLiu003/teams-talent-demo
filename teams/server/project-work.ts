import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, readFile, readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { DomainError, type DemoState, type Role } from '../src/domain.js';
import { deliveryRequirement, requirementNode, requireDeliveryMember } from '../src/delivery-requirements.js';
import type { Presentation } from '../src/api.js';
import type { ProjectWorkAction, ProjectWorkPlan, ProjectWorkReceipt, ProjectWorkSelection } from '../src/project-work.js';
import { nativeWorkDefaults, startNativeWork } from './native.js';
import { codeRoot, root, runtimeDir, sessionId, workspace, origin } from './config.js';
import { formatShellCommand } from './terminal-launcher.js';
import { collaborationContext, collaborationSkillPath } from './collaboration-service.js';
import { atomicJson, atomicText } from './store.js';

const execute = promisify(execFile);
const nodeNames: Record<string, string> = { prepare: '需求准备', develop: '开发', verify: '验证', accept: '验收' };
const stageNames: Record<string, string> = { content: '项目内容', management: '任务管理', delivery: '任务交付', release: '发布跟踪', settings: '项目设置' };
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function resolveProjectWork(state: DemoState, data: Presentation, input: ProjectWorkSelection) {
  if (!input || typeof input.projectId !== 'string' || !Object.hasOwn(stageNames, input.tab)) throw new DomainError('项目工作位置无效', 400);
  const target: ProjectWorkSelection = { projectId: input.projectId, tab: input.tab };
  const requirement = deliveryRequirement(state, input.projectId, input.taskId ?? input.requirementId);
  if (requirement) {
    if (input.taskId && input.requirementId && input.taskId !== input.requirementId) throw new DomainError('任务与需求标识不一致', 400);
    const nodeId = input.nodeId ?? requirementNode(requirement);
    if (!Object.hasOwn(nodeNames, nodeId)) throw new DomainError('交付节点不存在', 400);
    Object.assign(target, { taskId: requirement.id, requirementId: requirement.id, nodeId });
    const project = input.projectId === 'carddemo' ? state.workspace.project : state.workspace.projects?.find(item => item.id === input.projectId);
    if (!project) throw new DomainError('项目不存在', 404);
    return { target, projectName: project.name, title: requirement.title, location: nodeNames[nodeId], source: '独立交付需求与已登记的任务工作目录', repository: requirement.workDirectory ?? '', assets: project.assets ?? [], skills: requirement.skillIds };
  }
  if (input.projectId === 'carddemo') {
    if (input.taskId && input.taskId !== 'DEMO-MKT-001' || input.requirementId && input.requirementId !== 'DEMO-MKT-001') throw new DomainError('需求不属于当前项目', 400);
    target.requirementId = 'DEMO-MKT-001';
    if (input.tab === 'delivery') {
      const node = input.nodeId ?? (['submitted', 'accepted'].includes(state.stage) ? 'accept' : ['failed', 'fixed'].includes(state.stage) ? 'verify' : ['developing', 'returned'].includes(state.stage) ? 'develop' : 'prepare');
      if (!Object.hasOwn(nodeNames, node)) throw new DomainError('交付节点不存在', 400);
      target.taskId = 'DEMO-MKT-001'; target.nodeId = node;
    }
    return { target, projectName: state.workspace.project.name, title: '信用卡消费返现', location: target.nodeId ? nodeNames[target.nodeId] : stageNames[input.tab], source: 'CardDemo 当前源码与项目交付材料', repository: '', assets: state.workspace.project.assets, skills: state.context?.selectedSkills ?? state.workspace.selectedSkills };
  }
  if (input.projectId === 'teams') {
    const snapshot = data.teamsProject;
    let title = snapshot.project.name, location = stageNames[input.tab];
    if (input.tab === 'delivery' || input.taskId) {
      const task = snapshot.tasks.find(task => task.id === (input.taskId ?? snapshot.selection.taskId));
      if (!task) throw new DomainError('iCode Teams 任务不存在', 400);
      const node = task.nodes.find(node => node.id === (input.nodeId ?? (task.id === snapshot.selection.taskId ? snapshot.selection.nodeId : task.nodes[0].id)));
      if (!node) throw new DomainError('任务节点不存在', 400);
      Object.assign(target, { taskId: task.id, requirementId: 'REQ-' + task.id, nodeId: node.id }); title = task.title; location = node.name;
    }
    if (input.discussionId) { const discussion = snapshot.discussions.find(item => item.id === input.discussionId); if (!discussion) throw new DomainError('任务讨论不存在', 400); target.discussionId = discussion.id; title = discussion.title; }
    if (input.releaseId) { if (!snapshot.releases.some(item => item.name === input.releaseId)) throw new DomainError('发布版本不存在', 400); target.releaseId = input.releaseId; }
    return { target, projectName: snapshot.project.name, title, location, source: 'Teams 项目快照；尚无可恢复的本机会话记录', repository: 'github.com/SEAL-iCode/iCode-teams', assets: snapshot.documents.map(item => ({ title: item.path, location: item.path })), skills: snapshot.project.skills.map(skill => typeof skill === 'string' ? skill : String((skill as any).name ?? (skill as any).id)) };
  }
  const project = state.workspace.projects?.find(project => project.id === input.projectId);
  if (!project) throw new DomainError('项目不存在', 404);
  if (input.taskId || input.nodeId || input.requirementId) throw new DomainError('此项目尚未登记可启动的任务节点', 400);
  return { target, projectName: project.name, title: project.name, location: stageNames[input.tab], source: '新建项目；本次是项目阶段作业，不创建任务或推进交付', repository: project.remoteUrl, assets: project.assets ?? [], skills: [] as string[] };
}

/** Same repository-root/origin rules as Teams project-management/client/repository.ts. */
export function repositoryIdentity(value: string): string {
  const scp = /^(?:git@)?([A-Za-z0-9.-]+):([^/].*)$/.exec(value);
  const url = new URL(scp && !value.includes('://') ? `ssh://git@${scp[1]}/${scp[2]}` : value);
  if (!['https:', 'ssh:'].includes(url.protocol) || url.password || url.search || url.hash || url.protocol === 'https:' && url.username) throw new DomainError('代码仓地址必须是无凭据的 HTTPS/SSH 地址', 400);
  return url.hostname.toLowerCase() + (url.port && !(url.protocol === 'ssh:' && url.port === '22') ? ':' + url.port : '') + url.pathname.replace(/\/+$/, '').replace(/\.git$/, '');
}
async function inspectDirectory(directory: string, repository: string, sourceRoot: string) {
  if (typeof directory !== 'string' || !isAbsolute(directory) || directory.includes('\0')) throw new DomainError('请输入本机代码仓的绝对路径', 400);
  if (!(await stat(directory)).isDirectory()) throw new DomainError('所选位置不是目录');
  const canonical = await realpath(directory);
  let reference: string | undefined;
  try { reference = await realpath(sourceRoot); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if (reference && (canonical === reference || canonical.startsWith(reference + '/'))) throw new DomainError('此目录是只读的 Teams 参考仓；请绑定自己的可工作检出目录');
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_'))), LC_ALL: 'C', LANG: 'C' };
  const git = async (args: string[]) => (await execute('git', ['-C', canonical, ...args], { env, timeout: 5000, maxBuffer: 65536 })).stdout.trim();
  if (await realpath(await git(['rev-parse', '--show-toplevel'])) !== canonical) throw new DomainError('请选择 Git checkout 或 worktree 根目录');
  if (isAbsolute(repository)) {
    if (await realpath(repository) !== canonical) throw new DomainError('当前目录与项目登记的本机代码仓不一致');
  } else {
    const expected = repository.includes('://') || repository.startsWith('git@') ? repositoryIdentity(repository) : repository;
    if (repositoryIdentity(await git(['config', '--get', 'remote.origin.url'])) !== expected) throw new DomainError('目录 origin 与项目代码仓不一致');
  }
  return canonical;
}
type NativeDefaults = Awaited<ReturnType<typeof nativeWorkDefaults>>;
export interface WorkTransport {
  defaults(): Promise<NativeDefaults>;
  history(): Promise<{ available: boolean; directory: string; title: string; diagnostic?: string; configuration?: NonNullable<ProjectWorkPlan['history']>['configuration']; active: NonNullable<ProjectWorkPlan['history']>['active'] }>;
  start(input: Parameters<typeof startNativeWork>[0]): Promise<unknown>;
  focus(history: NonNullable<ProjectWorkPlan['history']>): Promise<{ status: string; note: string }>;
}
const nativeTransport: WorkTransport = {
  defaults: nativeWorkDefaults,
  async history() { return { available: false, directory: workspace, title: '', active: null }; },
  start: startNativeWork,
  async focus() { throw new Error('历史恢复入口已移除'); },
};
interface SavedRequest { identity: string; receipt: ProjectWorkReceipt }
export class ProjectWorkService {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private current: () => DemoState, private data: Presentation, private directory = runtimeDir, private transport: WorkTransport = nativeTransport) {}
  private async bindings(): Promise<Record<string, string>> {
    try { const value = JSON.parse(await readFile(join(this.directory, 'project-work-bindings.json'), 'utf8')); if (!value || Array.isArray(value) || Object.values(value).some(path => typeof path !== 'string' || !isAbsolute(path))) throw new Error('本机目录绑定记录损坏'); return value; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw error; }
  }
  private async previous(target: ProjectWorkSelection) {
    let files: string[];
    try { files = await readdir(join(this.directory, 'project-work')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
    const requests = await Promise.all(files.filter(file => /^[0-9a-f-]+\.json$/.test(file)).map(async file => JSON.parse(await readFile(join(this.directory, 'project-work', file), 'utf8')) as SavedRequest));
    return requests.filter(item => JSON.stringify(item.receipt.target) === JSON.stringify(target)).sort((a, b) => b.receipt.at.localeCompare(a.receipt.at))[0]?.receipt;
  }
  async plan(role: Role, input: ProjectWorkSelection): Promise<ProjectWorkPlan> {
    const state = this.current(), work = resolveProjectWork(state, this.data, input);
    const requirement = deliveryRequirement(state, work.target.projectId, work.target.taskId);
    let directory: ProjectWorkPlan['directory'];
    if (requirement) {
      directory = { root: requirement.workDirectory ?? null, valid: false, kind: 'git-binding', diagnostic: '此需求尚未登记可工作的独立代码目录。' };
      if (requirement.workDirectory) try { directory.root = await inspectDirectory(requirement.workDirectory, requirement.workDirectory, this.data.baseline.sourceRoot); directory.valid = true; directory.diagnostic = '本需求工作目录与 Git 根目录已核验；自动执行仅作用于此目录。'; } catch (error) { directory.diagnostic = (error as Error).message; }
    } else if (work.target.projectId === 'carddemo') {
      await access(join(codeRoot, 'docs/design/08-marketing-capability.md'));
      directory = { root: await realpath(codeRoot), valid: true, kind: 'imported-snapshot', diagnostic: '已核验本机导入源码快照；该快照没有 .git，不宣称已完成生产仓库绑定。' };
    } else {
      const binding = (await this.bindings())[role + ':' + work.target.projectId];
      directory = { root: binding ?? null, valid: false, kind: 'git-binding', diagnostic: '尚未绑定本机目录，请先核验并关联一个与项目代码仓一致的 checkout/worktree。' };
      if (binding) try { directory.root = await inspectDirectory(binding, work.repository, this.data.baseline.sourceRoot); directory.valid = true; directory.diagnostic = '本机仓库根目录与项目 origin 已核验。'; } catch (error) { directory.diagnostic = (error as Error).message; }
    }
    const defaults = await this.transport.defaults();
    const frozen = requirement ? !!requirement.preparedAt : work.target.projectId === 'carddemo' && !!work.target.taskId && !!state.context;
    const context = { frozen, summary: requirement ? frozen ? '本需求已确认准备依据；继续核对当前节点和任务采用记录。' : '本需求尚未确认准备依据；iCode 先读取上下文并明确采用。' : frozen ? `已冻结 ${state.context!.id}；保持本次需求、资料与采用版本。` : '尚未冻结：本次只提供当前项目与工作位置的快照，不等同于已采用知识或已读取全部资料。', versions: requirement ? requirement.inputDigest ?? '本需求尚未记录采用摘要' : frozen ? `知识 ${state.context!.knowledgeVersion} · Skill ${state.context!.skillVersion} · Agent ${state.context!.agentVersion}` : '当前资料与选择；采用版本尚未冻结', selectedSkills: work.skills, assets: work.assets.map(asset => ({ title: asset.title, location: asset.location })) };
    let taskStartReason: string | undefined;
    if (requirement) {
      try { requireDeliveryMember(state, requirement, role); } catch (error) { taskStartReason = (error as Error).message; }
      if (['awaiting-acceptance', 'accepted'].includes(requirement.stage) || work.target.nodeId === 'accept') taskStartReason = '当前需求已进入 Owner 验收，不再自动启动开发工作';
    }
    const actions: ProjectWorkPlan['actions'] = [{ id: 'new', label: requirement ? '新建会话并执行当前任务' : '新建当前工作的 iCode 会话', enabled: !!defaults && !defaults.terminal.error && directory.valid && !taskStartReason, reason: !defaults ? '配套 iCode 未安装' : defaults.terminal.error ?? (!directory.valid ? directory.diagnostic : taskStartReason) }];
    const plan: ProjectWorkPlan = { executionMode: requirement ? 'task-file' : 'interactive', target: work.target, projectName: work.projectName, title: work.title, location: work.location, source: work.source, planToken: '', instance: { installed: !!defaults, name: '本机 iCode', ...defaults }, directory, context, actions, defaultAction: 'new' };
    plan.planToken = hash({ role, plan, revision: state.revision });
    plan.previous = await this.previous(work.target); return plan;
  }
  bind(role: Role, input: ProjectWorkSelection, directory: string) {
    const next = this.queue.then(() => this.bindDirectory(role, input, directory)); this.queue = next.catch(() => undefined); return next;
  }
  private async bindDirectory(role: Role, input: ProjectWorkSelection, directory: string) {
    const work = resolveProjectWork(this.current(), this.data, input);
    if (work.target.projectId === 'carddemo') throw new DomainError('CardDemo 使用已经核验的导入源码位置');
    const canonical = await inspectDirectory(directory, work.repository, this.data.baseline.sourceRoot);
    const bindings = await this.bindings(); bindings[role + ':' + input.projectId] = canonical;
    await atomicJson(join(this.directory, 'project-work-bindings.json'), bindings);
    return this.plan(role, input);
  }
  start(role: Role, body: { requestId: string; target: ProjectWorkSelection; action: ProjectWorkAction; planToken: string }) {
    const next = this.queue.then(() => this.run(role, body)); this.queue = next.catch(() => undefined); return next;
  }
  private async run(role: Role, body: { requestId: string; target: ProjectWorkSelection; action: ProjectWorkAction; planToken: string }) {
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(body.requestId) || !['new', 'resume', 'focus'].includes(body.action)) throw new DomainError('作业请求格式无效', 400);
    const identity = hash({ role, ...body }), path = join(this.directory, 'project-work', body.requestId + '.json');
    try { const saved = JSON.parse(await readFile(path, 'utf8')) as SavedRequest; if (saved.identity !== identity) throw new DomainError('此请求标识已用于另一项工作'); return saved.receipt; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const plan = await this.plan(role, body.target);
    if (plan.planToken !== body.planToken) throw new DomainError('启动依据已变化，请重新读取并确认');
    const action = plan.actions.find(action => action.id === body.action);
    if (!action?.enabled) throw new DomainError(action?.reason ?? '当前会话动作不可用');
    const requirement = deliveryRequirement(this.current(), plan.target.projectId, plan.target.taskId);
    if (requirement) {
      requireDeliveryMember(this.current(), requirement, role);
      if (['awaiting-acceptance', 'accepted'].includes(requirement.stage) || plan.target.nodeId === 'accept') throw new DomainError('当前需求已进入 Owner 验收，不再自动启动开发工作');
    }
    const directory = body.action === 'new' ? plan.directory.root! : plan.history!.directory;
    const contextPath = join(this.directory, 'work-contexts', body.requestId + '.md');
    const context = await collaborationContext(this.current(), this.data, plan.target);
    const contextJsonPath = join(this.directory, 'work-contexts', body.requestId + '.json');
    await atomicJson(contextJsonPath, context);
    const scopePath = join(this.directory, 'work-contexts', body.requestId + '.scope.json');
    await atomicJson(scopePath, plan.target);
    const command = formatShellCommand([process.execPath, join(root, 'scripts/teams-demo.mjs'), '--endpoint', origin, '--role', role, 'context', 'get', '--input-file', scopePath, '--output', contextJsonPath]);
    const instruction = `请先读取 Teams 协作 Skill：${collaborationSkillPath}，再读取本次作业入口 ${contextPath}。当前角色 ${role}，后续 CLI 命令保留 --role ${role}。开始时执行：${command}。按 Skill 明确记录实际采用的输入，并以 runId=${body.requestId} 回传进展与证据；新会话 ID 尚未确认，不得填入其他会话。`;
    const nativeSessionPath = join(this.directory, 'work-contexts', body.requestId + '.native', 'native-session.json');
    const taskInstructions = requirement ? `\n## 本次自动执行授权\n${requirement.description}\n\n这是用户授权的独立 Teams 交付需求。实际代码仅可修改本次工作目录 ${directory}，不得修改 Teams 应用工程、原始参考资料、全局 iCode 设置、任何历史会话或其他任务；不要提交、推送、部署或另行委派 agent。\n\n先读取本 Skill、context get 返回的需求/知识/所选 Skill 正文，记录实际采用依据。原生观察器会把本次会话的真实标识写入 ${nativeSessionPath}；读取其中 sessionId，核对 runId、projectId、taskId 与本任务相同。若文件尚未创建，可每 1 秒读取一次、最多等 15 秒；仍未出现则报告失败并停止，禁止编造或选用历史 ID。\n\n按照 Skill 使用 Teams CLI 自行执行 prepare、develop、verify 三个节点的 inputs adopt、progress add 与 result submit。每次切换节点重新 context get，以返回的 revision 和 basisDigest 采用；不要复用旧节点 adoptionId。先报告 started，开发里程碑及时报告 progress。遇到问题报告 blocked 与证据，修复后报告解除原因。编写实际代码并运行需求约定的小范围测试，保留文件与日志证据。验证节点如使用预置 Review/安全检查，必须标注 source=preset；真实测试标注 source=actual，不声称真实外部扫描通过。严格按当前 CLI 合同提交开发和验证成果，最终停在待 Owner 验收；禁止调用 Owner 验收、直接修改 state 文件或绕过 CLI 写 API。遇到 API 或真实执行错误如实报告，不修改服务实现补状态。\n\n写操作使用稳定 operationId 并保留 CLI 请求/回执。不要用独立脚本一次性伪造节点进度：每个回传必须对应你已完成的实际读取、开发、检查或修复。完成时报告改动文件、测试命令、真实 sessionId、CLI 回执和未确认业务规则。\n` : '';
    const content = `# ${plan.projectName} · ${plan.title}\n\n工作位置：${plan.location}\n来源：${plan.source}\n\n${plan.context.summary}\n采用版本：${plan.context.versions}\n\n## 工作标识\n${JSON.stringify({ ...plan.target, role, runId: body.requestId, sessionId: body.action === 'new' ? null : plan.history!.sessionId }, null, 2)}\n\n## 项目资料与选择\n${JSON.stringify(plan.context, null, 2)}\n\n## 开始工作时读取\n${instruction}\n\n准备时读取的结构化上下文：${contextJsonPath}\n${taskInstructions}\n本文件由 Teams 导出。提供入口不代表 iCode 已读取、采用或完成工作。\n`;
    await atomicText(contextPath, content);
    const receipt: ProjectWorkReceipt = { executionMode: plan.executionMode, requestId: body.requestId, target: plan.target, action: body.action, status: 'prepared', at: new Date().toISOString(), directory, sessionId: body.action === 'new' ? null : plan.history!.sessionId, contextPath, instruction, note: '启动请求已准备；尚未观察到原生会话。' };
    await atomicJson(path, { identity, receipt });
    try {
      if (body.action === 'focus') { const focused = await this.transport.focus(plan.history!); receipt.status = 'terminal-focused'; receipt.note = focused.note; }
      else { const started = await this.transport.start({ directory, terminal: plan.instance.terminal!.id, agent: body.action === 'resume' ? plan.history!.configuration!.agent : plan.instance.agent!, model: body.action === 'resume' ? plan.history!.configuration!.model : plan.instance.model!, ...(receipt.sessionId ? { sessionId: receipt.sessionId } : {}), ...(requirement ? { task: { runId: body.requestId, path: contextPath, scope: { projectId: plan.target.projectId, taskId: requirement.id, nodeId: plan.target.nodeId! } } } : {}), instruction }); receipt.status = 'terminal-requested'; if (started && typeof started === 'object' && 'terminal' in started && typeof started.terminal === 'string') receipt.terminal = started.terminal; receipt.note = '已请求 ' + (receipt.terminal ?? '系统终端') + (requirement ? ' 自动下发任务至新的 iCode 会话；真实执行与回传结果以任务进度和原生记录为准。' : ' 打开对应工作目录的 iCode；终端受理不等于模型执行、上下文读取或任务完成。'); }
      await atomicJson(path, { identity, receipt }); return receipt;
    } catch (error) {
      receipt.status = 'uncertain'; receipt.note = '原生请求结果待核对：' + (error as Error).message + '。原请求已保留，不会自动重发或另开会话。'; await atomicJson(path, { identity, receipt }); throw new DomainError(receipt.note);
    }
  }
}
