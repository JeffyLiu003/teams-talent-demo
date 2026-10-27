/** Isolated HTTP integration. No browser, native tool, real payment, or external model is invoked. */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import type { DemoState } from '../src/domain.js';
import { initialState } from '../src/domain.js';
import { campaign } from '../src/cashback.js';
import { sharedPaths, type PublishedArtifact, type TalentsKnowledge, type TeamsSnapshot } from '../../shared/contracts.js';

const root = resolve(import.meta.dirname, '..');
async function unusedPort(): Promise<number> {
  const socket = createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = (socket.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => socket.close(error => error ? reject(error) : resolve())); return port;
}
const directory = await mkdtemp(join(tmpdir(), 'teams-workflow-http-'));
let children: ChildProcess[] = [], logs = '';
const port = await unusedPort();
const teams = `http://127.0.0.1:${port}`;
const statePath = join(directory, 'teams', 'state.json'), shared = join(directory, 'shared');
const env = { ...process.env, DEMO_PORT: String(port), DEMO_STATE_DIR: join(directory, 'teams'), DEMO_SHARED_DIR: shared, DEMO_SHARED_SEED_DIR: join(directory, 'no-seed'), DEMO_NATIVE_DISABLED: '1' };
const get = async (base: string, path: string) => {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(3000) });
  const value = await response.json(); assert.equal(response.status, 200, JSON.stringify(value)); return value;
};
const state = async (): Promise<DemoState> => get(teams, '/api/state');
async function post(base: string, path: string, body: Record<string, unknown>, expected = 200) {
  const { token } = await get(base, '/api/session');
  const response = await fetch(base + path, { method: 'POST', signal: AbortSignal.timeout(5000), headers: { Origin: base, 'Content-Type': 'application/json', 'X-Demo-Token': token }, body: JSON.stringify({ revision: (await state()).revision, role: 'owner', projectId: 'carddemo', ...body }) });
  const value = await response.json(); assert.equal(response.status, expected, JSON.stringify(value)); return value;
}
const action = (name: string, role = 'owner', expected = 200) => post(teams, '/api/action', { action: name, role, ...(name === 'assign' ? { assigneeId: 'member' } : {}) }, expected);
/** Stands in for the Talents service: publishes one artifact into the shared data directory. */
async function publishFromTalents(version: number) {
  const artifact: PublishedArtifact = { id: 'a-biz', projectId: 'carddemo', name: '信用卡营销返现业务知识', description: '白金卡返现规则', capability: 'doc-extract', capabilityName: '业务知识提取', category: 'doc', kind: 'files', version, publishedAt: '2026-10-27T10:00:00.000Z', note: '新增白金卡规则', delivery: 'local', files: [{ path: 'doc-knowledge/业务规则目录.md', title: '业务规则目录', type: 'markdown' }] };
  const knowledge: TalentsKnowledge = { schemaVersion: 1, exportedAt: new Date().toISOString(), artifacts: [artifact] };
  await mkdir(join(shared, 'talents', 'files', 'a-biz', 'v' + version, 'doc-knowledge'), { recursive: true });
  await writeFile(join(shared, sharedPaths.talentsFile('a-biz', version, 'doc-knowledge/业务规则目录.md')), '# 业务规则目录 v' + version);
  await writeFile(join(shared, sharedPaths.talentsKnowledge), JSON.stringify(knowledge));
}
const snapshot = async (): Promise<TeamsSnapshot> => JSON.parse(await readFile(join(shared, sharedPaths.teamsSnapshot), 'utf8'));
async function start() {
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout!.on('data', data => logs += data); child.stderr!.on('data', data => logs += data); children.push(child);
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Service exited before readiness: ' + logs);
    try { await get(teams, '/api/health'); return; } catch { await delay(100); }
  }
  throw new Error('Service startup timeout: ' + logs);
}
async function stop() {
  await Promise.all(children.map(async child => {
    if (child.exitCode !== null) return;
    const exited = once(child, 'exit'); child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000); timer.unref();
    try { await exited; } finally { clearTimeout(timer); }
  })); children = [];
}
try {
  await start();
  const first = await state();
  assert.equal(first.campaignId, campaign.id); assert.equal(first.knowledge, false);
  await action('assign', 'member', 403); await action('accept', 'owner', 409); await action('prepare', 'member', 409);
  await action('knowledge', 'owner', 400);
  await post(teams, '/api/reset', { role: 'member' }, 403);
  assert.deepEqual(await state(), first);
  const exported = await snapshot();
  assert.deepEqual(exported.team.members.map(member => member.name), ['林悦', '陈晨', '苏晴', '杨帆', '赵宁', '王晓']);
  const card = exported.projects.find(project => project.id === 'carddemo')!;
  assert.equal(card.repositories[0].path, 'workspace/carddemo-java-1025'); assert.ok(card.documents.length >= 3);
  assert.ok(exported.projects.find(project => project.id === 'teams')!.readonly);
  assert.ok(exported.sessions.length > 0); assert.ok(!exported.sessions.some(session => session.id === 'WORK-PLATINUM-001'));
  console.log('PASS 1/5: role enforcement, unmet prerequisites and manual knowledge are rejected; snapshot exported on startup');

  assert.deepEqual((await get(teams, '/api/talents/knowledge?project=carddemo')).artifacts, []);
  await publishFromTalents(1);
  const synced = await state(); assert.equal(synced.knowledge, true); assert.equal(synced.knowledgeVersion, '信用卡营销返现业务知识 v1');
  assert.equal(synced.audit.at(-1)!.detail, 'Talents 已发布项目知识：信用卡营销返现业务知识 v1');
  assert.equal((await get(teams, '/api/talents/knowledge?project=carddemo')).artifacts.length, 1);
  assert.equal((await get(teams, '/api/talents/file?artifact=a-biz&version=1&path=' + encodeURIComponent('doc-knowledge/业务规则目录.md'))).content, '# 业务规则目录 v1');
  console.log('PASS 2/5: knowledge published by Talents is shown and marks project knowledge as built');

  await action('assign'); const staleRevision = (await state()).revision - 1;
  await post(teams, '/api/action', { action: 'assign', revision: staleRevision }, 409);
  await action('prepare', 'member'); const frozen = structuredClone((await state()).context);
  assert.equal(frozen!.knowledgeVersion, '信用卡营销返现业务知识 v1');
  await action('replay', 'member');
  await post(teams, '/api/workspace', { kind: 'progress.sync', role: 'member', payload: { text: '已完成资格和期间规则实现' } });
  await action('check-fail', 'member'); await action('submit', 'member', 409);
  await action('fix', 'member'); await action('submit', 'member');
  await post(teams, '/api/action', { action: 'return', reason: '补充金额边界' });
  await action('accept', 'owner', 409); await action('fix', 'member'); await action('submit', 'member');
  assert.equal((await state()).enrolled, false); await action('purchase');
  const ledger = await state(); assert.equal(ledger.transactions.length, 1); assert.equal(ledger.transactions[0].reward, 0.6); assert.equal(ledger.balance, 2670.15);
  await action('purchase', 'owner', 409); assert.deepEqual(await state(), ledger);
  await action('deduplicate'); await action('uat'); await action('accept');
  await post(teams, '/api/workspace', { kind: 'session.report', role: 'member', payload: {} }, 409);
  await delay(200);
  assert.equal((await state()).workspace.sessionReported, false);
  await publishFromTalents(2);
  const completed = await state(); assert.equal(completed.stage, 'accepted'); assert.equal(completed.security, 'unverified');
  assert.equal(completed.knowledgeVersion, '信用卡营销返现业务知识 v2'); assert.deepEqual(completed.context, frozen);
  console.log('PASS 3/5: two-role delivery, return/resubmit, 0.5% ledger, dedup; shared session; new knowledge keeps frozen context');

  await stop(); await start(); assert.deepEqual(await state(), completed);
  assert.deepEqual(JSON.parse(await readFile(statePath, 'utf8')), completed);
  await post(teams, '/api/reset', {});
  const reset = await state(); assert.equal(reset.stage, 'draft'); assert.equal(reset.transactions.length, 0); assert.equal(reset.knowledgeVersion, '信用卡营销返现业务知识 v2');
  console.log('PASS 4/5: state survives restart; reset re-syncs the knowledge Talents still publishes');

  await stop(); const legacy = initialState(); delete legacy.campaignId;
  await mkdir(join(directory, 'teams'), { recursive: true }); await writeFile(statePath, JSON.stringify(legacy));
  await rm(join(shared, 'talents'), { recursive: true, force: true });
  await start(); const oldBytes = await readFile(statePath, 'utf8');
  await action('assign', 'owner', 409);
  await post(teams, '/api/workspace', { kind: 'project.update', payload: { name: 'Changed', description: 'Changed', repository: 'Changed' } }, 409);
  assert.equal(await readFile(statePath, 'utf8'), oldBytes);
  await post(teams, '/api/reset', { role: 'member' }, 403); await post(teams, '/api/reset', {});
  assert.equal((await state()).campaignId, campaign.id); await action('assign'); assert.equal((await state()).stage, 'assigned');
  console.log('PASS 5/5: old campaign is preserved/readable, writes blocked, explicit Owner reset restores operation');
  console.log('HTTP integration: 5/5 passed');
} finally { await stop(); await rm(directory, { recursive: true, force: true }); }
