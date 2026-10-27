// Native iCode Hook bridge. Does not call a model or write Teams business state.
import { readFile, writeFile, realpath, rename } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
async function atomic(path, value) { const temp = path + '.' + randomUUID() + '.tmp'; await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); await rename(temp, path); }
async function main() {
  const manifestPath = process.env.TEAMS_TUI_MANIFEST;
  if (!manifestPath) return; // Ordinary iCode sessions are unaffected.
  if (!isAbsolute(manifestPath)) throw new Error('Teams TUI context locator is invalid');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')), directory = dirname(await realpath(manifestPath));
  if (manifest.version !== 1 || manifest.executionMode !== 'interactive' || !uuid.test(manifest.runId) || !manifest.scope?.projectId || !manifest.scope?.taskId || !['prepare', 'develop', 'verify'].includes(manifest.scope.nodeId)) throw new Error('Teams TUI context scope is invalid');
  const payloadPath = process.env.ICODE_HOOK_PAYLOAD_FILE ?? process.env.CHRYS_HOOK_PAYLOAD_FILE;
  const resultPath = process.env.ICODE_HOOK_RESULT ?? process.env.CHRYS_HOOK_RESULT;
  if (!payloadPath || !resultPath) throw new Error('Native Hook payload/result channel is absent');
  const payload = JSON.parse(await readFile(payloadPath, 'utf8'));
  if (!['session_start', 'user_prompt_submit'].includes(payload.event) || !uuid.test(payload.session_id) || await realpath(payload.cwd) !== manifest.directory) throw new Error('Native Hook session or directory does not match the Teams work');
  const bytes = await readFile(manifest.taskFile);
  if (createHash('sha256').update(bytes).digest('hex') !== manifest.taskSha256) throw new Error('Teams work context changed after confirmation');
  const receipt = { runId: manifest.runId, ...manifest.scope, sessionId: payload.session_id, event: payload.event, at: new Date().toISOString(), contextSha256: manifest.taskSha256, source: 'icode-native-hook' };
  const boundPath = join(directory, 'tui-hook-session.json');
  let bound;
  try { bound = JSON.parse(await readFile(boundPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (bound && bound.sessionId !== payload.session_id) throw new Error('This Teams work is already bound to a different native session');
  if (!bound) await atomic(boundPath, receipt);
  if (payload.event === 'user_prompt_submit') {
    const reminder = `This interactive iCode session belongs to Teams project ${manifest.scope.projectId}, task ${manifest.scope.taskId}, current node ${manifest.scope.nodeId}, run ${manifest.runId}, native session ${payload.session_id}. Read the exact Teams work context file ${manifest.taskFile} and its Teams collaboration Skill before business work. Use only the current selected node; do not automatically advance to other nodes. Follow the developer's interactive instructions. Record actual adopted context and progress through the scoped Teams CLI. Opening this TUI and receiving this reminder do not prove material reading, adoption, work completion, or Owner acceptance.`;
    await writeFile(resultPath, JSON.stringify({ action: 'allow', system_reminder: reminder }));
    await atomic(join(directory, 'tui-context-injected.json'), { ...receipt, status: 'reminder-returned' });
  } else await writeFile(resultPath, JSON.stringify({ action: 'allow' }));
}
main().catch(error => { console.error('Teams 工作上下文 Hook 失败：' + error.message); process.exitCode = 1; });
