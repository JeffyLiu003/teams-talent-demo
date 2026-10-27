import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initialState } from '../src/domain.js';
import { createDeliveryRequirement } from '../src/delivery-requirements.js';
import { collectTaskSessions } from '../src/task-automation.js';
import type { TalentTaskSessionPayload } from '../src/talent-contract.js';
import { exportTaskSessions, sharedTaskInputs, taskSessionPayloadDigest, validateTaskIntakes } from '../server/talent-intake.js';
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
  const payload: TalentTaskSessionPayload = { projectId: task.projectId, taskId: task.id, deliveryId: 'delivery-test-001', idempotencyKey: 'intake-test-001', acceptedAt, inputDigest: task.inputDigest, sessions: collectTaskSessions(state, { projectId: task.projectId, taskId: task.id }) };
  return { state, task, payload };
}
async function using(work: (directory: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'shared-intake-unit-'));
  try { await work(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}
const exportPath = async (dir: string) => join(dir, 'teams/task-sessions', (await readdir(join(dir, 'teams/task-sessions')))[0]);

test('shared task inputs read actual registered packages and requirement facts without changing Teams state', async () => {
  const { state, task } = fixture(), original = structuredClone(state);
  const input = await sharedTaskInputs(state, 'carddemo', task.id), pkg = await loadSourceSkillPackage('dev-code-reviewer');
  assert.equal(input.knowledge.status, 'ready');
  assert.equal(input.knowledge.assets[0].detail, task.description); assert.equal(input.knowledge.assets[0].origin, 'teams-task');
  assert.equal(input.skills[0].source, 'teams-registered-package'); assert.equal(input.skills[0].sha256, pkg.sha256);
  assert.equal(input.skills[0].content, pkg.files.find(file => file.path === 'SKILL.md')!.bytes.toString('utf8'));
  assert.deepEqual(state, original); assert.equal(state.knowledge, false);
  await assert.rejects(sharedTaskInputs(state, 'carddemo', 'MKT-MISSING'), /不存在/);
  await assert.rejects(sharedTaskInputs(state, 'teams', task.id), /不属于/);
});

test('accepted task sessions persist one exact export receipt and retries reject conflicting payloads', async () => using(async dir => {
  const { state, payload } = fixture();
  const [a, b] = await Promise.all([exportTaskSessions(state, payload, dir), exportTaskSessions(state, payload, dir)]);
  assert.deepEqual(a, b); assert.match(a.id, /^SHARED-/); assert.equal(a.payloadSha256, taskSessionPayloadDigest(payload));
  assert.deepEqual(a.sessionIds, ['test-session-001']);
  const path = await exportPath(dir), original = await readFile(path);
  assert.deepEqual(await exportTaskSessions(structuredClone(state), payload, dir), a); assert.deepEqual(await readFile(path), original);
  await assert.rejects(exportTaskSessions(state, { ...payload, deliveryId: 'another' }, dir), /不同上报内容/);
  const broken = JSON.parse(original.toString()); broken.payload.sessions[0].sessionId = 'tampered';
  await writeFile(path, JSON.stringify(broken)); await assert.rejects(exportTaskSessions(state, payload, dir), /内容与回执不一致/);
}));

test('sharing rejects unaccepted, wrong digest, duplicate, foreign and malformed sessions', async () => using(async dir => {
  const { state, task, payload } = fixture();
  task.stage = 'awaiting-acceptance'; await assert.rejects(exportTaskSessions(state, payload, dir), /尚未验收/); task.stage = 'accepted';
  await assert.rejects(exportTaskSessions(state, { ...payload, inputDigest: 'b'.repeat(64) }, dir), /采用依据/);
  await assert.rejects(exportTaskSessions(state, { ...payload, taskId: 'MKT-OTHER' }, dir), /不存在/);
  await assert.rejects(exportTaskSessions(state, { ...payload, sessions: [payload.sessions[0], payload.sessions[0]] }, dir), /未按工具和标识去重/);
  await assert.rejects(exportTaskSessions(state, { ...payload, sessions: [{ ...payload.sessions[0], sessionId: 'foreign' }] }, dir), /节点关联不一致/);
  await assert.rejects(exportTaskSessions(state, { ...payload, sessions: [] }, dir), /不能为空/);
  await assert.rejects(exportTaskSessions(state, { ...payload, sessions: [{ ...payload.sessions[0], nodeIds: ['prepare'] }] }, dir), /开发与验证/);
  assert.deepEqual(await readdir(dir), []);
}));

test('failed shared persistence returns no receipt and a retry can recover', async () => using(async dir => {
  const { state, payload } = fixture(), original = structuredClone(state), block = join(dir, 'teams');
  await writeFile(block, 'blocked'); await assert.rejects(exportTaskSessions(state, payload, dir)); assert.deepEqual(state, original);
  await rm(block); assert.equal((await exportTaskSessions(state, payload, dir)).taskId, payload.taskId);
}));

test('sharing preserves complete session JSON and rejects forged or unrelated documents', async () => using(async dir => {
  const { state, payload } = fixture();
  const document = (content: string, sessionId = payload.sessions[0].sessionId) => ({ sessionId, content, sha256: createHash('sha256').update(content).digest('hex') });
  const content = JSON.stringify({ meta: { session_id: payload.sessions[0].sessionId }, messages: [{ role: 'assistant', content: '隔离协议测试'.repeat(10000) }] });
  const valid = document(content);
  await assert.rejects(exportTaskSessions(state, { ...payload, sessionDocuments: [{ ...valid, sha256: 'b'.repeat(64) }] }, dir), /内容与摘要不一致/);
  await assert.rejects(exportTaskSessions(state, { ...payload, sessionDocuments: [document('not JSON')] }, dir), /不是合法 JSON/);
  await assert.rejects(exportTaskSessions(state, { ...payload, sessionDocuments: [document('{}', 'another-session')] }, dir), /不属于上报范围/);
  await assert.rejects(exportTaskSessions(state, { ...payload, sessionDocuments: [valid, valid] }, dir), /清单无效|重复/);
  const receipt = await exportTaskSessions(state, { ...payload, sessionDocuments: [valid] }, dir);
  assert.deepEqual(receipt.documentHashes, [{ sessionId: valid.sessionId, sha256: valid.sha256 }]);
  const persisted = JSON.parse(await readFile(await exportPath(dir), 'utf8')); validateTaskIntakes([persisted]);
  assert.equal(persisted.payload.sessionDocuments[0].content, content);
}));
