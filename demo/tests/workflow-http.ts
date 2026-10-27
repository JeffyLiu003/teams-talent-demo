import {nodeResultFixture} from './node-contract-fixtures.js';
import type {RequirementNode} from '../src/delivery-requirements.js';
/** Isolated HTTP integration. No browser, native tool, real payment, or external model is invoked. */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import {randomUUID} from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { DemoState } from '../src/domain.js';
import { initialState } from '../src/domain.js';
import { campaign } from '../src/cashback.js';

const root = resolve(import.meta.dirname, '..');
async function unusedPort(): Promise<number> {
  const socket = createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = (socket.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => socket.close(error => error ? reject(error) : resolve())); return port;
}
const directory = await mkdtemp(join(tmpdir(), 'talent-workflow-http-'));
let children: ChildProcess[] = [], logs = '';
const port = await unusedPort(); let talentPort = await unusedPort(); while (talentPort === port) talentPort = await unusedPort();
const teams = `http://127.0.0.1:${port}`, talent = `http://127.0.0.1:${talentPort}`;
const statePath = join(directory, 'teams', 'state.json');
const env = { ...process.env, DEMO_PORT: String(port), DEMO_TALENT_PORT: String(talentPort), DEMO_STATE_DIR: join(directory, 'teams'), DEMO_TALENT_STATE_DIR: join(directory, 'talent'), DEMO_NATIVE_DISABLED: '1' };
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
const action = (name: string, role = 'owner', expected = 200) => post(['knowledge', 'candidate', 'evaluate', 'release'].includes(name) ? talent : teams, '/api/action', { action: name, role, ...(name==='assign'?{assigneeId:'member'}:{}) }, expected);
async function start() {
  for (const script of ['server/index.ts', 'server/talent.ts']) {
    const child = spawn(process.execPath, ['--import', 'tsx', script], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout!.on('data', data => logs += data); child.stderr!.on('data', data => logs += data); children.push(child);
  }
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (children.some(child => child.exitCode !== null)) throw new Error('Service exited before readiness: ' + logs);
    try { await get(teams, '/api/health'); await get(talent, '/api/health'); return; } catch { await delay(100); }
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
  const first = await state(), a = await get(teams, '/api/health'), b = await get(talent, '/api/health');
  assert.notEqual(a.pid, b.pid); assert.notEqual(a.stateRoot, b.stateRoot); assert.equal(first.campaignId, campaign.id);
  await action('assign', 'member', 403); await action('knowledge', 'member', 403);
  await action('accept', 'owner', 409); await action('prepare', 'member', 409);
  await post(teams, '/api/action', { action: 'knowledge' }, 400);
  await post(teams, '/api/reset', { role: 'member' }, 403);
  assert.deepEqual(await state(), first);
  console.log('PASS 1/5: isolated services, role enforcement and unmet prerequisites preserve state');

  await action('knowledge');
  const knowledge = await get(talent, '/api/knowledge/assets?project=carddemo');
  assert.equal(knowledge.assets.length, 4); assert.ok(knowledge.assets.every((asset: any) => asset.sourceProjectId === 'carddemo'));
  await action('assign'); const staleRevision = (await state()).revision - 1;
  await post(teams, '/api/action', { action: 'assign', revision: staleRevision }, 409);
  const scope={projectId:'carddemo',taskId:'DEMO-MKT-001'},runId=randomUUID(),sessionId=randomUUID();
  const task=async()=> (await state()).workspace.deliveryRequirements!.find(item=>item.id===scope.taskId)!;
  await post(teams,'/api/task-automation',{...scope,step:'knowledge',role:'member'});
  const adopt=async(nodeId:string)=>{const context=await get(teams,'/api/collaboration/context?'+new URLSearchParams({...scope,nodeId}));return post(teams,'/api/collaboration',{role:'member',kind:'inputs.adopt',operationId:randomUUID(),input:{...scope,nodeId,runId,sessionId,expectedRevision:context.revision,basisDigest:context.basisDigest,readReferences:context.skills.map((skill:any)=>skill.id)}});};
  const result=async(nodeId:string,adoptionId:string,checks?:unknown,expected=200)=>post(teams,'/api/collaboration',{role:'member',kind:'result.submit',operationId:randomUUID(),input:{...scope,nodeId,runId,sessionId,adoptionId,expectedRevision:(await state()).revision,summary:'隔离协议检查',...nodeResultFixture(nodeId as RequirementNode,{failed:Array.isArray(checks)&&checks.some(check=>check.status==='failed')}),...(checks?{checks}:nodeId==='verify'?{checks:undefined}:{})}},expected);
  const prepared=await adopt('prepare');assert.equal((await task()).stage,'preparing');await result('prepare',prepared.receipt.adoptionId);const frozen=structuredClone((await task()).talentInputsSnapshot);
  for(const actionName of ['replay','check-fail','fix','submit'])await action(actionName,'member',409);
  await post(teams,'/api/workspace',{kind:'progress.sync',role:'member',payload:{text:'旧进度写入口'}},409);
  const development=await adopt('develop');await result('develop',development.receipt.adoptionId);
  let verification=await adopt('verify');await result('verify',verification.receipt.adoptionId,nodeResultFixture('verify',{failed:true}).checks);
  assert.equal((await task()).stage,'verifying');await post(teams,'/api/delivery-requirements',{...scope,action:'accept'},409);
  await result('verify',verification.receipt.adoptionId,nodeResultFixture('verify').checks);
  await post(teams,'/api/delivery-requirements',{...scope,action:'return',reason:'补充边界'});
  const repeat=await adopt('develop');await result('develop',repeat.receipt.adoptionId);verification=await adopt('verify');await result('verify',verification.receipt.adoptionId,undefined,409);
  await result('verify',verification.receipt.adoptionId,nodeResultFixture('verify').checks);
  const nativeRoot=join(directory,'teams','work-contexts',runId+'.native'),sessionRoot=join(nativeRoot,'session-root');
  const documentDirectory=join(sessionRoot,'sessions',sessionId.replaceAll('-','').slice(0,12));await mkdir(documentDirectory,{recursive:true});
  await writeFile(join(documentDirectory,'session.json'),JSON.stringify({meta:{session_id:sessionId},state:{fixture:'isolated protocol; no model invoked'}}));
  await writeFile(join(nativeRoot,'native-session.json'),JSON.stringify({source:'icode-active-session-owner',...scope,runId,sessionId,sessionRoot}));
  await writeFile(join(nativeRoot,'result.json'),JSON.stringify({runId,sessionId,status:'completed'}));
  await post(teams,'/api/delivery-requirements',{...scope,action:'accept',role:'member'},403);
  await post(teams,'/api/delivery-requirements',{...scope,action:'accept'});
  const collection=async()=> (await state()).workspace.taskAutomation!.find(item=>item.taskId===scope.taskId)!.collection!;
  for(let i=0;i<80&&(await collection()).reporting?.status!=='reported';i++)await delay(100);
  assert.equal((await collection()).reporting?.status,'reported');assert.equal((await collection()).reporting?.receipt?.documentHashes?.length,1);
  await post(teams, '/api/workspace', { kind: 'session.report', role: 'member', payload: {} },409);
  await post(talent, '/api/workspace', { kind: 'analysis.run', role: 'member', payload: { scope: 'project' } }, 403);
  await post(talent, '/api/workspace', { kind: 'analysis.run', payload: { scope: 'project' } },409);
  await action('candidate','owner',409);
  const completed=await state();assert.equal((await task()).stage,'accepted');assert.equal(completed.evolution,'none');assert.equal(completed.security,'unverified');assert.deepEqual((await task()).talentInputsSnapshot,frozen);assert.deepEqual(completed.transactions,first.transactions);assert.equal(completed.stage,first.stage);
  const snapshot = await get(talent, '/api/bootstrap?project=carddemo');
  assert.equal(snapshot.data.talent.project.projection.status, 'confirmed'); assert.equal(snapshot.data.talent.project.evolution.status, 'none');
  console.log('PASS 2/5: unified CLI delivery, mixed-check gate, fresh recheck after return and persisted scoped Talent fixture receipt');

  await stop(); await start(); assert.deepEqual(await state(), completed);
  const restored = await get(talent, '/api/bootstrap?project=carddemo');
  assert.deepEqual(restored.data.talent.project, snapshot.data.talent.project);
  assert.deepEqual(JSON.parse(await readFile(statePath, 'utf8')), completed);
  console.log('PASS 3/5: both independent stores survive service restart without changing frozen context');

  const projectId = 'df7c9722-3878-4ae4-b047-0785f844b5bb';
  await post(teams, '/api/workspace', { kind: 'project.create', payload: { id: projectId, name: '独立项目', description: '', remoteUrl: 'https://example.test/project', repositoryIdentity: 'example.test/project' } });
  assert.deepEqual((await get(talent, '/api/knowledge/assets?project=' + projectId)).assets, []);
  await post(talent, '/api/action', { action: 'knowledge', projectId }, 409);
  await post(teams, '/api/workspace', { kind: 'asset.link', payload: { projectId, sourceAssetId: 'design-library:teams:AGENTS.md' } });
  await post(talent, '/api/action', { action: 'knowledge', projectId });
  const separate = await get(talent, '/api/knowledge/assets?project=' + projectId); assert.equal(separate.assets.length, 1); assert.equal(separate.assets[0].sourceProjectId, projectId);
  assert.equal((await get(talent, '/api/knowledge/assets?project=carddemo')).assets.length, 4);
  await post(teams, '/api/reset', {});
  assert.equal((await state()).stage, 'draft'); assert.equal((await state()).transactions.length, 0);
  assert.deepEqual((await get(talent, '/api/knowledge/assets?project=carddemo')).assets, []);
  console.log('PASS 4/5: independent project knowledge and deliberate reset invalidate stale Talent projections');

  await stop(); await rm(statePath+'.pre-unified-delivery.json',{force:true}); const legacy = initialState(); delete legacy.campaignId;
  await mkdir(join(directory, 'teams'), { recursive: true }); await writeFile(statePath, JSON.stringify(legacy));
  await start(); const oldBytes = await readFile(statePath, 'utf8');
  await action('assign', 'owner', 409);
  await post(teams, '/api/workspace', { kind: 'project.update', payload: { name: 'Changed', description: 'Changed', repository: 'Changed' } }, 409);
  assert.equal(await readFile(statePath, 'utf8'), oldBytes);
  await post(teams, '/api/reset', { role: 'member' }, 403); await post(teams, '/api/reset', {});
  assert.equal((await state()).campaignId, campaign.id); await action('assign'); assert.equal((await state()).workspace.deliveryRequirements!.find(item=>item.id==='DEMO-MKT-001')!.assigneeId,'member');
  console.log('PASS 5/5: old campaign is preserved/readable, writes blocked, explicit Owner reset restores operation');
  console.log('HTTP integration: 5/5 passed');
} finally { await stop(); await rm(directory, { recursive: true, force: true }); }
