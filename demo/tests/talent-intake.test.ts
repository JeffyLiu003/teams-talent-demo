import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initialState } from '../src/domain.js';
import { createDeliveryRequirement } from '../src/delivery-requirements.js';
import { collectTaskSessions } from '../src/task-automation.js';
import type { TalentIntegrationContext, TalentTaskSessionPayload } from '../src/talent-contract.js';
import { TalentStore } from '../server/talent-store.js';
import { TalentTaskIntakeService, taskSessionPayloadDigest } from '../server/talent-intake.js';
import { loadSourceSkillPackage } from '../server/skill-packages.js';

const firstAt = '2026-10-27T01:00:00.000Z', acceptedAt = '2026-10-27T01:05:00.000Z';
function fixture() {
  const state = initialState();
  const task = createDeliveryRequirement(state, 'owner', { id: 'MKT-E2E-001', projectId: 'carddemo', title: '验证独立任务收件', description: '隔离测试数据', assigneeId: 'member', skillIds: ['dev-code-reviewer'] }, firstAt);
  task.stage = 'accepted'; task.acceptedAt = acceptedAt; task.inputDigest = 'a'.repeat(64);
  state.workspace.taskAutomation = [{ projectId: 'carddemo', taskId: task.id, sessions: [
    { projectId: 'carddemo', taskId: task.id, nodeId: 'develop', tool: 'icode', sessionId: 'test-session-001', source: 'manual', at: firstAt },
    { projectId: 'carddemo', taskId: task.id, nodeId: 'verify', tool: 'icode', sessionId: 'test-session-001', source: 'manual', at: firstAt },
  ] }];
  const project = { id: 'carddemo', name: '隔离项目', generation: 'initial', assets: state.workspace.project.assets };
  const context: TalentIntegrationContext = { token: 'test-only', state, project, projects: [project] };
  const payload: TalentTaskSessionPayload = { projectId: project.id, taskId: task.id, deliveryId: 'delivery-test-001', idempotencyKey: 'intake-test-001', acceptedAt, inputDigest: task.inputDigest, sessions: collectTaskSessions(state, { projectId: task.projectId, taskId: task.id }) };
  return { context, task, payload };
}
async function using(work: (store: TalentStore, path: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'talent-intake-unit-')), path = join(dir, 'talent-state.json');
  try { const store = new TalentStore(path); await store.init(); await work(store, path); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('Talent task inputs read actual registered packages and actual project knowledge without writing either state', async () => using(async (store, path) => {
  const { context } = fixture(), original = await readFile(path), teams = structuredClone(context.state), service = new TalentTaskIntakeService(store, async () => context, 'http://127.0.0.1:1');
  const input = await service.inputs('carddemo', 'MKT-E2E-001'), pkg = await loadSourceSkillPackage('dev-code-reviewer');
  assert.equal(input.knowledge.status, 'not-built'); assert.deepEqual(input.knowledge.assets, []); assert.equal(input.skills.length, 1);
  assert.equal(input.skills[0].source, 'teams-registered-package'); assert.equal(input.skills[0].sha256, pkg.sha256); assert.equal(input.skills[0].content, pkg.files.find(file => file.path === 'SKILL.md')!.bytes.toString('utf8'));
  assert.deepEqual(await readFile(path), original); assert.deepEqual(context.state, teams);
  await assert.rejects(service.inputs('carddemo', 'MKT-MISSING'), /不存在/); await assert.rejects(service.inputs('teams', 'MKT-E2E-001'), /不匹配/);
  const project = store.project(context.project); project.knowledge.status = 'ready'; project.knowledge.version = 'knowledge-test';
  project.knowledge.assets = [{ id: 'knowledge-test', pluginId: 'business-knowledge', sourceProjectId: 'carddemo', title: '已保存的业务知识' } as any]; await store.save(project);
  assert.equal((await service.inputs('carddemo', 'MKT-E2E-001')).knowledge.assets[0].id, 'knowledge-test');
  project.projection = { status: 'pending', action: 'knowledge' }; await store.save(project); assert.equal((await service.inputs('carddemo', 'MKT-E2E-001')).knowledge.status, 'not-built');
}));

test('Talent receives exact accepted task sessions once and persists the unchanged receipt across restarts', async () => using(async (store, path) => {
  const { context, payload } = fixture(), service = new TalentTaskIntakeService(store, async () => context, 'http://127.0.0.1:1');
  const [a,b] = await Promise.all([service.receive(payload), service.receive(payload)]); assert.deepEqual(a,b); assert.equal(a.payloadSha256, taskSessionPayloadDigest(payload)); assert.deepEqual(a.sessionIds, ['test-session-001']);
  assert.equal(store.state.taskIntakes?.length, 1); assert.equal(store.state.revision, 1); assert.deepEqual(store.state.projects, {});
  const original = await readFile(path), reloaded = new TalentStore(path); await reloaded.init(); assert.deepEqual(await new TalentTaskIntakeService(reloaded, async () => context, 'http://127.0.0.1:1').receive(payload), a); assert.deepEqual(await readFile(path), original);
  await assert.rejects(service.receive({ ...payload, deliveryId: 'another-delivery' }), /不同上报内容/); assert.deepEqual(await readFile(path), original);
  const broken = JSON.parse(original.toString()); broken.taskIntakes[0].payload.sessions[0].sessionId = 'tampered'; const text = JSON.stringify(broken); await writeFile(path, text); await assert.rejects(new TalentStore(path).init(), /内容与回执不一致/); assert.equal(await readFile(path, 'utf8'), text);
}));

test('Talent rejects unaccepted, wrong digest, duplicate, foreign and malformed sessions without a receipt', async () => using(async (store, path) => {
  const { context, task, payload } = fixture(), service = new TalentTaskIntakeService(store, async () => context, 'http://127.0.0.1:1'), original = await readFile(path);
  task.stage = 'awaiting-acceptance'; await assert.rejects(service.receive(payload), /尚未验收/); task.stage = 'accepted';
  await assert.rejects(service.receive({ ...payload, inputDigest: 'b'.repeat(64) }), /采用依据/);
  await assert.rejects(service.receive({ ...payload, taskId: 'MKT-OTHER' }), /不存在/);
  await assert.rejects(service.receive({ ...payload, sessions: [payload.sessions[0],payload.sessions[0]] }), /未按工具和标识去重/);
  await assert.rejects(service.receive({ ...payload, sessions: [{ ...payload.sessions[0], sessionId: 'another-task-session' }] }), /节点关联不一致/);
  await assert.rejects(service.receive({ ...payload, sessions: [] }), /不能为空/);
  await assert.rejects(service.receive({ ...payload, sessions: [{ ...payload.sessions[0], nodeIds: ['prepare'] }] }), /开发与验证/);
  await assert.rejects(service.receive({ ...payload, inputDigest: 'unverified' }), /摘要无效/);
  assert.deepEqual(await readFile(path), original); assert.equal(store.state.taskIntakes, undefined);
}));

test('failed Talent persistence does not return success or mutate the in-memory inbox; legacy files are not migrated on startup', async () => using(async (store, path) => {
  const original = await readFile(path), loaded = new TalentStore(path); await loaded.init(); assert.deepEqual(await readFile(path), original);
  const { context, payload } = fixture(), service = new TalentTaskIntakeService(store, async () => context, 'http://127.0.0.1:1');
  await rm(path); await mkdir(path); await assert.rejects(service.receive(payload)); assert.equal(store.state.revision, 0); assert.equal(store.state.taskIntakes, undefined);
  await rm(path, { recursive: true }); await writeFile(path, original); const receipt = await service.receive(payload); assert.equal(receipt.taskId, payload.taskId); assert.equal(JSON.parse(await readFile(path, 'utf8')).taskIntakes.length, 1);
}));

test('Talent preserves complete session JSON and rejects forged, duplicate or unrelated documents', async () => using(async (store, path) => {
  const { context, payload } = fixture(), service = new TalentTaskIntakeService(store, async () => context, 'http://127.0.0.1:1');
  const document = (content: string, sessionId = payload.sessions[0].sessionId) => ({ sessionId, content, sha256: createHash('sha256').update(content).digest('hex') });
  const content = JSON.stringify({ meta: { session_id: payload.sessions[0].sessionId }, messages: [{ role: 'assistant', content: '仅隔离测试会话正文' }] }, null, 2) + '\n', valid = document(content);
  await assert.rejects(service.receive({ ...payload, sessionDocuments: [{ ...valid, sha256: 'b'.repeat(64) }] }), /内容与摘要不一致/);
  await assert.rejects(service.receive({ ...payload, sessionDocuments: [document('not JSON')] }), /不是合法 JSON/);
  await assert.rejects(service.receive({ ...payload, sessionDocuments: [document('{}', 'another-session')] }), /不属于上报范围/);
  await assert.rejects(service.receive({ ...payload, sessionDocuments: [valid, valid] }), /清单无效|重复/);
  await assert.rejects(service.receive({ ...payload, sessionDocuments: [document(JSON.stringify({ meta: { session_id: 'wrong-session' } }))] }), /自身标识/);
  const receipt = await service.receive({ ...payload, sessionDocuments: [valid] }); assert.deepEqual(receipt.documentHashes, [{ sessionId: valid.sessionId, sha256: valid.sha256 }]);
  const persisted = JSON.parse(await readFile(path, 'utf8')); assert.equal(persisted.taskIntakes[0].payload.sessionDocuments[0].content, content);
  await assert.rejects(service.receive(payload), /不同上报内容/); assert.equal(store.state.taskIntakes?.length, 1);
}));

test('explicit task input registration preserves exact requirement facts without building project knowledge or changing legacy tasks', async () => using(async (store, path) => {
  const { context, task } = fixture(), service = new TalentTaskIntakeService(store, async () => context, 'http://127.0.0.1:1'), beforeTeams = structuredClone(context.state);
  const [first, again] = await Promise.all([service.register('carddemo', task.id), service.register('carddemo', task.id)]); assert.deepEqual(first, again); assert.equal(store.state.revision, 1);
  assert.equal(first.asset.detail, task.description); assert.equal(first.asset.origin, 'teams-task'); assert.equal(first.source.taskId, task.id); assert.equal(first.source.createdAt, task.createdAt);
  assert.deepEqual(context.state, beforeTeams); assert.deepEqual(store.state.projects, {}); assert.equal(context.state.knowledge, false);
  const input = await service.inputs('carddemo', task.id); assert.equal(input.knowledge.status, 'ready'); assert.equal(input.knowledge.assets.length, 1); assert.equal(input.knowledge.assets[0].detail, task.description); assert.equal(input.knowledge.taskRegistration?.sourceDigest, first.sourceDigest);
  assert.equal((await service.inputs('carddemo', 'DEMO-MKT-001')).knowledge.status, 'not-built'); await assert.rejects(service.register('carddemo', 'DEMO-MKT-001'), /只有独立交付需求/);
  const other = createDeliveryRequirement(context.state, 'owner', { id: 'MKT-E2E-OTHER', projectId: 'carddemo', title: '另一个独立任务', description: '不能串用登记', assigneeId: 'member', skillIds: ['dev-code-reviewer'] }, firstAt); assert.equal((await service.inputs('carddemo', other.id)).knowledge.status, 'not-built');
  const original = await readFile(path), reloaded = new TalentStore(path); await reloaded.init(); assert.deepEqual(reloaded.state.taskInputRegistrations![0], first); assert.deepEqual(await readFile(path), original);
  task.description += ' 后续变更'; await assert.rejects(service.register('carddemo', task.id), /不能覆盖/); await assert.rejects(service.inputs('carddemo', task.id), /版本不匹配/); assert.deepEqual(await readFile(path), original);
  const bad = JSON.parse(original.toString()); bad.taskInputRegistrations[0].asset.detail += ' 篡改'; await writeFile(path, JSON.stringify(bad)); await assert.rejects(new TalentStore(path).init(), /摘要不一致/);
}));

test('before adoption a new Skill selection registers another input version and preserves the original',async()=>using(async(store)=>{
 const {context,task}=fixture();task.stage='preparing';delete task.preparedAt;
 const service=new TalentTaskIntakeService(store,async()=>context,'http://127.0.0.1:1');
 const original=await service.register('carddemo',task.id);task.skillIds=['dev-unit-test'];
 await assert.rejects(service.inputs('carddemo',task.id),/重新检查任务输入/);
 const updated=await service.register('carddemo',task.id);assert.notEqual(updated.version,original.version);assert.deepEqual(store.state.taskInputRegistrations?.[0],original);assert.equal(store.state.taskInputRegistrations?.length,2);
 const inputs=await service.inputs('carddemo',task.id);assert.deepEqual(inputs.skills.map(skill=>skill.id),['dev-unit-test']);assert.equal(inputs.knowledge.taskRegistration?.version,updated.version);
 task.preparedAt=firstAt;task.skillIds=['dev-frontend-ui'];await assert.rejects(service.register('carddemo',task.id),/不能覆盖/);
}));
