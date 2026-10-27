import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initialState } from '../src/domain.js';
import { createDeliveryRequirement } from '../src/delivery-requirements.js';
import { collectTaskSessions } from '../src/task-automation.js';
const dir = await mkdtemp(join(tmpdir(), 'talent-intake-http-')), origin = 'http://127.0.0.1:46191', talentOrigin = 'http://127.0.0.1:46192';
const at = '2026-10-27T01:00:00.000Z', acceptedAt = '2026-10-27T01:05:00.000Z';
const state = initialState(), task = createDeliveryRequirement(state, 'owner', { id: 'MKT-E2E-001', projectId: 'carddemo', title: '隔离 HTTP 接口任务', description: '仅测试真实 HTTP 接收合同', assigneeId: 'member', skillIds: ['dev-code-reviewer'] }, at);
const project = { id: 'carddemo', name: '隔离 HTTP 项目', generation: 'test-generation', assets: state.workspace.project.assets };
state.workspace.taskAutomation = [{ projectId: 'carddemo', taskId: task.id, sessions: [{ projectId: 'carddemo', taskId: task.id, nodeId: 'develop', tool: 'icode', sessionId: 'http-test-session-001', source: 'manual', at }] }];
// This is an integration fixture source, not a live Teams service or a real model session.
const source = createServer((request, response) => { response.setHeader('content-type', 'application/json'); if (request.url?.startsWith('/api/integrations/talent/context?')) response.end(JSON.stringify({ token: 'test-only', state, project, projects: [project] })); else { response.statusCode = 404; response.end('{}'); } });
let server: ChildProcess | undefined, logs = '';
const path = join(dir, 'talent', 'talent-state.json'); await mkdir(join(dir, 'talent')); const original = JSON.stringify({ schemaVersion: 1, revision: 0, projects: {} }); await writeFile(path, original);
const start = async () => {
  server = spawn(process.execPath, ['--import', 'tsx', 'server/talent.ts'], { env: { ...process.env, DEMO_PORT: '46191', DEMO_TALENT_PORT: '46192', DEMO_STATE_DIR: join(dir, 'teams'), DEMO_TALENT_STATE_DIR: join(dir, 'talent'), DEMO_NATIVE_DISABLED: '1' }, stdio: ['ignore','pipe','pipe'] });
  server.stdout!.on('data', data => logs += data); server.stderr!.on('data', data => logs += data);
  for (let i = 0; i < 100; i++) { try { if ((await fetch(talentOrigin + '/api/health')).ok) return; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error(logs || 'Talent 未启动');
};
const stop = async () => { if (!server || server.exitCode !== null) return; const stopped = new Promise(resolve => server!.once('exit', resolve)); server.kill('SIGTERM'); await stopped; };
try {
  await new Promise<void>(resolve => source.listen(46191, '127.0.0.1', resolve)); await start();
  let token = (await (await fetch(talentOrigin + '/api/session')).json() as any).token;
  const post = async (body: unknown, auth = token, sourceOrigin = origin) => fetch(talentOrigin + '/api/task-sessions', { method: 'POST', headers: { origin: sourceOrigin, 'content-type': 'application/json', 'x-demo-token': auth }, body: JSON.stringify(body) });
  const inputResponse = await fetch(talentOrigin + '/api/task-inputs?projectId=carddemo&taskId=' + task.id); assert.equal(inputResponse.status, 200); const inputs = await inputResponse.json() as any;
  assert.equal(inputs.knowledge.status, 'not-built'); assert.equal(inputs.skills[0].source, 'teams-registered-package'); assert.ok(inputs.skills[0].content.includes('code-reviewer'));
  assert.equal((await fetch(talentOrigin + '/api/task-inputs?projectId=carddemo&taskId=MKT-MISSING')).status, 404);
  const document = JSON.stringify({ meta: { session_id: 'http-test-session-001' }, messages: [{ role: 'assistant', content: '隔离协议测试内容'.repeat(10000) }] });
  const documentSha = createHash('sha256').update(document).digest('hex');
  const tooLargeAction = await fetch(talentOrigin + '/api/action', { method: 'POST', headers: { origin, 'content-type': 'application/json', 'x-demo-token': token }, body: JSON.stringify({ action: 'knowledge', role: 'owner', extra: 'x'.repeat(65537) }) }); assert.equal(tooLargeAction.status, 413);
  const payload = { sessionDocuments: [{ sessionId: 'http-test-session-001', sha256: documentSha, content: document }], projectId: 'carddemo', taskId: task.id, deliveryId: 'http-delivery', idempotencyKey: 'http-intake', acceptedAt, inputDigest: 'a'.repeat(64), sessions: collectTaskSessions(state, { projectId: 'carddemo', taskId: task.id }) };
  assert.equal((await post(payload, 'invalid')).status, 403); assert.equal((await post(payload, token, 'http://untrusted.example')).status, 403); assert.equal((await post(payload)).status, 409); assert.equal(await readFile(path, 'utf8'), original);
  const register = (role: string) => fetch(talentOrigin + '/api/task-inputs/register', { method: 'POST', headers: { origin, 'content-type': 'application/json', 'x-demo-token': token }, body: JSON.stringify({ role, projectId: 'carddemo', taskId: task.id }) });
  assert.equal((await register('member')).status, 403); assert.equal(await readFile(path, 'utf8'), original);
  const registered = await register('owner'); assert.equal(registered.status, 200); const registration = await registered.json() as any; assert.equal(registration.asset.origin, 'teams-task'); assert.equal(registration.asset.detail, task.description); const registrationBytes = await readFile(path, 'utf8'); assert.equal((await register('owner')).status, 200); assert.equal(await readFile(path, 'utf8'), registrationBytes);
  const prepared = await (await fetch(talentOrigin + '/api/task-inputs?projectId=carddemo&taskId=' + task.id)).json() as any; assert.equal(prepared.knowledge.status, 'ready'); assert.equal(prepared.knowledge.assets[0].detail, task.description); assert.equal(state.knowledge, false);
  task.stage = 'accepted'; task.acceptedAt = acceptedAt; task.inputDigest = payload.inputDigest;
  const response = await post(payload); assert.equal(response.status, 200, await response.clone().text()); const receipt = await response.json(); const persisted = await readFile(path, 'utf8');
  assert.equal((await post({ ...payload, deliveryId: 'conflicting-delivery' })).status, 409); assert.equal(await readFile(path, 'utf8'), persisted);
  await stop(); await start(); token = (await (await fetch(talentOrigin + '/api/session')).json() as any).token; const repeated = await post(payload); assert.equal(repeated.status, 200); assert.deepEqual(await repeated.json(), receipt); assert.equal(await readFile(path, 'utf8'), persisted);
  const inbox = JSON.parse(persisted); assert.equal(inbox.taskIntakes[0].payload.sessionDocuments[0].content, document); assert.equal(inbox.taskIntakes[0].receipt.documentHashes[0].sha256, documentSha); assert.equal(inbox.taskIntakes.length, 1); assert.deepEqual(inbox.projects, {}); assert.equal(inbox.revision, 2);
  await mkdir('test-results/talent-intake', { recursive: true }); await writeFile('test-results/talent-intake/http-result.json', JSON.stringify({ passed: true, checks: ['real Talent HTTP inputs', 'registered Skill full body', 'missing/unaccepted/auth rejected', 'Owner task-fact registration leaves project knowledge untouched', 'accepted scoped inbox', 'conflicting key rejected', 'restart idempotency', 'full session document above 64KiB persisted with hash', 'legacy state untouched until receive'], receipt }, null, 2));
  console.log('Talent intake HTTP passed: real server, auth, scoped receive, persistence and restart idempotency.');
} finally { await stop(); await new Promise<void>(resolve => source.close(() => resolve())); await rm(dir, { recursive: true, force: true }); }
