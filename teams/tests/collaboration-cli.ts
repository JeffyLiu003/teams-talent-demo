import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { Store } from '../server/store.js';

const dir = await mkdtemp(join(tmpdir(), 'teams-collaboration-'));
const origin = 'http://127.0.0.1:45977', talent = 'http://127.0.0.1:45987';
const env = { ...process.env, DEMO_PORT: '45977', DEMO_TALENT_PORT: '45987', DEMO_STATE_DIR: join(dir, 'teams'), DEMO_SHARED_DIR: join(dir, 'shared'), DEMO_NATIVE_DISABLED: '1' };
const children = ['server/index.ts', 'server/talent.ts'].map(file => spawn(process.execPath, ['--import', 'tsx', file], { env, stdio: ['ignore', 'pipe', 'pipe'] }));
let logs = ''; for (const child of children) { child.stdout!.on('data', d => logs += d); child.stderr!.on('data', d => logs += d); }
const get = async (base: string, path: string) => { const r = await fetch(base + path); assert.equal(r.status, 200, await r.clone().text()); return r.json(); };
const state = () => get(origin, '/api/state');
const cli = async (args: string[], success = true) => {
  try { const { stdout } = await promisify(execFile)(process.execPath, ['scripts/teams-demo.mjs', '--endpoint', origin, '--receipt-dir', join(dir, 'receipts'), ...args]); assert.ok(success, 'CLI unexpectedly succeeded'); return JSON.parse(stdout); }
  catch (error: any) { if (success) throw error; assert.ok(error.code); return JSON.parse(error.stderr); }
};
const scope = { projectId: 'carddemo', taskId: 'DEMO-MKT-001', nodeId: 'develop' };
const context = (selected: object = scope) => cli(['context', 'get', '--input', JSON.stringify(selected)]);
const post = async (base: string, path: string, body: object, expected = 200) => { const session = await get(base, '/api/session'); const r = await fetch(base + path, { method: 'POST', headers: { origin: base, 'content-type': 'application/json', 'x-demo-token': session.token }, body: JSON.stringify({ revision: (await state()).revision, role: 'owner', ...body }) }); const v = await r.json(); assert.equal(r.status, expected, JSON.stringify(v)); return v; };
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  let ready = false; for (let i = 0; i < 100; i++) { try { await get(origin, '/api/health'); await get(talent, '/api/health'); ready = true; break; } catch {} await new Promise(r => setTimeout(r, 100)); } assert.ok(ready, logs);
  const before = JSON.stringify(await state());
  const preparation = await context(); assert.equal(preparation.mode, 'preparation'); assert.equal(preparation.agreement.id, scope.taskId); assert.deepEqual(preparation.agreement.criteria, (await get(origin, '/api/bootstrap')).data.blueprint.acceptance_criteria); assert.equal(JSON.stringify(await state()), before);
  assert.match((await cli(['context','get','--project','teams','--task','DEMO-MKT-001','--node','develop'], false)).error, /任务不属于/);
  assert.match((await cli(['context','get','--project','teams','--task','T104','--node','wrong'], false)).error, /节点不属于/);
  const teamsContext = await context({projectId:'teams',taskId:'T104',nodeId:'review'}); assert.equal(teamsContext.agreement.title,'加入团队后获取项目配置'); assert.ok(!JSON.stringify(teamsContext).includes('DEMO-MKT-001'));
  const createdId=randomUUID(); await post(origin,'/api/workspace',{kind:'project.create',payload:{id:createdId,name:'CLI 空项目',description:'上下文隔离',remoteUrl:'https://example.test/cli',repositoryIdentity:'example.test/cli'}});
  const empty = await context({projectId:createdId,tab:'content'});assert.equal(empty.agreement.title,'CLI 空项目');assert.equal(empty.skills.length,0);assert.equal(empty.references.length,0);
  await post(origin,'/api/workspace',{kind:'resource.publish-all',payload:{}});
  const catalog=(await get(origin,'/api/bootstrap')).data;const pinned=catalog.skillCatalog.find((item:any)=>item.id==='audit-evidence');assert.equal(pinned.version,'2.0.0');
  await post(origin,'/api/workspace',{kind:'skills.select',role:'member',payload:{skills:['audit-evidence']}},409);
  await post(origin,'/api/workspace',{kind:'resource.acquire',role:'member',payload:{name:pinned.id,version:pinned.version,sha256:pinned.sha256}});
  await post(talent,'/api/action',{action:'knowledge',projectId:'carddemo'});
  await post(origin,'/api/action',{action:'assign'});
  await post(origin,'/api/workspace',{kind:'skills.select',role:'member',payload:{skills:['dev-frontend-ui','teams-collaboration','office-word','audit-evidence']}});
  await post(origin,'/api/workspace',{kind:'material.add',role:'member',payload:{title:'CLI 专属需求依据',body:'实际阅读的输入，不是自动采用。'}});
  await post(origin,'/api/action',{action:'prepare',role:'member'});
  const frozen = await cli(['context','get','--input',JSON.stringify(scope),'--output',join(dir,'context.json')]);
  assert.equal(frozen.mode,'frozen');assert.equal(frozen.agent.configuration.codeAgentVersion,'r1');assert.equal(frozen.knowledge.selectedVersion,'knowledge-v1');assert.equal(frozen.knowledge.status,'available');assert.ok(frozen.knowledge.assets.every((a:any)=>a.sourceProjectId==='carddemo'));
  assert.ok(frozen.skills.find((s:any)=>s.id==='teams-collaboration').content.includes('inputs adopt'));assert.equal(frozen.skills.find((s:any)=>s.id==='office-word').path,null);assert.equal(frozen.skills.find((s:any)=>s.id==='office-word').availability,'example-only');assert.ok(frozen.references.some((r:any)=>r.references.some((ref:any)=>ref.content)));
  const subscribedSkill=frozen.skills.find((item:any)=>item.id==='audit-evidence');assert.equal(subscribedSkill.version,pinned.version);assert.equal(subscribedSkill.sha256,pinned.sha256);assert.equal(subscribedSkill.contentSha256,pinned.contentSha256);assert.equal(subscribedSkill.content,catalog.skillContents[pinned.id]);assert.equal(subscribedSkill.loadedByAgent,false);
  assert.equal(JSON.parse(await readFile(join(dir,'context.json'),'utf8')).basisDigest,frozen.basisDigest);
  const talentBefore = await readFile(join(dir,'talent/talent-state.json'));
  const runId=randomUUID(),sessionId='isolated-session-'+randomUUID();
  let input={...scope,runId,sessionId,expectedRevision:frozen.revision,basisDigest:frozen.basisDigest,readReferences:[frozen.references[0].id,'teams-collaboration']};
  const operationId=randomUUID();const adoptArgs=['inputs','adopt','--operation-id',operationId,'--input',JSON.stringify(input)];
  const adopted=await cli(adoptArgs);assert.equal(adopted.ok,true);assert.ok(adopted.receipt.adoptionId);
  const replayed=await cli(adoptArgs);assert.equal(replayed.replayed,true);assert.deepEqual(replayed.receipt,adopted.receipt);assert.equal((await state()).workspace.collaboration.adoptions.length,1);
  const changed=await cli(['inputs','adopt','--operation-id',operationId,'--input',JSON.stringify({...input,readReferences:[]})],false);assert.match(changed.error,/不同请求/);
  const recovered=await cli(['operation','get','--operation-id',operationId]);assert.deepEqual(recovered.receipt,adopted.receipt);
  const progress={...scope,runId,sessionId,adoptionId:adopted.receipt.adoptionId,expectedRevision:adopted.receipt.revision,phase:'started',summary:'CLI 开始范围内的需求开发',evidence:[]};
  const wrongRole=await cli(['progress','add','--role','owner','--operation-id',randomUUID(),'--input',JSON.stringify(progress)],false);assert.match(wrongRole.error,/HTTP 403/);
  const wrongNode=await cli(['progress','add','--operation-id',randomUUID(),'--input',JSON.stringify({...progress,nodeId:'verify'})],false);assert.match(wrongNode.error,/范围不符/);
  const wrongSession=await cli(['progress','add','--operation-id',randomUUID(),'--input',JSON.stringify({...progress,sessionId:'different'})],false);assert.match(wrongSession.error,/范围不符/);
  const started=await cli(['progress','add','--operation-id',randomUUID(),'--input',JSON.stringify(progress)]);
  const stale=await cli(['progress','add','--operation-id',randomUUID(),'--input',JSON.stringify(progress)],false);assert.match(stale.error,/revision/);
  const blocked=await cli(['progress','add','--operation-id',randomUUID(),'--input',JSON.stringify({...progress,expectedRevision:started.receipt.revision,phase:'blocked',summary:'CLI 等待支付接口契约确认',blocker:'需要 Owner 确认本次字段范围'})]);
  const saved=await state();assert.equal(saved.workspace.collaboration.events.at(-1).sessionId,sessionId);assert.equal(saved.stage,'assigned');assert.equal(saved.checks,'none');assert.equal(saved.security,'unverified');
  await post(origin,'/api/action',{action:'accept',role:'member'},403);await post(origin,'/api/action',{action:'submit',role:'member'},409);
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/teams?demo-role=owner#/projects?project=carddemo&tab=content');await page.locator('.overview-report').filter({hasText:'CLI 等待支付接口契约确认'}).waitFor();await page.getByRole('button',{name:/作业待协调/}).waitFor();
  await mkdir('test-results/collaboration',{recursive:true});await page.screenshot({path:'test-results/collaboration/owner-blocked.png',fullPage:true});
  await page.goto(origin+'/teams?demo-role=member#/projects?project=carddemo&tab=delivery&node=develop');await page.getByText('CLI 等待支付接口契约确认',{exact:true}).waitFor();await page.getByRole('button',{name:'查看会话、操作与证据引用',exact:true}).last().click();await page.locator('.drawer-console').getByText(sessionId,{exact:false}).waitFor();await page.screenshot({path:'test-results/collaboration/member-receipt.png',fullPage:true});
  const result=await cli(['result','submit','--operation-id',randomUUID(),'--input',JSON.stringify({...progress,expectedRevision:blocked.receipt.revision,summary:'已核对接口契约，提交本机实现说明待确认',evidence:[{kind:'local-file',value:join(dir,'context.json'),description:'本机读取上下文的输出；未上传'}]})]);
  const after=await state();assert.equal(after.workspace.collaboration.events.at(-1).phase,'result');assert.equal(after.stage,'assigned');assert.equal(after.security,'unverified');assert.equal(after.checks,'none');
  await page.goto(origin+'/teams?demo-role=owner#/projects?project=carddemo&tab=content');await page.locator('.overview-report').filter({hasText:'结果待确认'}).waitFor();assert.equal(await page.getByRole('button',{name:/作业待协调/}).count(),0);
  assert.equal((await context()).basisDigest,frozen.basisDigest);assert.deepEqual(await readFile(join(dir,'talent/talent-state.json')),talentBefore);
  const reloaded=new Store(join(dir,'teams/state.json'));await reloaded.init();assert.deepEqual(reloaded.state,after);
  const corrupt=structuredClone(after);corrupt.workspace.collaboration.events[0].phase='accepted';await writeFile(join(dir,'broken.json'),JSON.stringify(corrupt));await assert.rejects(new Store(join(dir,'broken.json')).init(),/协作记录损坏/);
  // Native work remains mocked/disabled; no launch/focus endpoint is called by this test.
  assert.deepEqual(errors,[]);await writeFile('test-results/collaboration/result.json',JSON.stringify({passed:true,scope,runId,sessionId,adoption:adopted.receipt,blocked:blocked.receipt,result:result.receipt,checks:['read-only preparation','frozen exact versions and Talent HTTP','3 project isolation','scope/role/session/revision rejects','stable operation replay and persisted receipts','API and Owner/member visible progress','result keeps quality and acceptance unchanged','Talent state unchanged','state reload and corrupt-record rejection'],events:after.workspace.collaboration.events},null,2));
  console.log('Collaboration CLI/API/browser checks passed');
} finally { await browser?.close(); await Promise.all(children.map(child=>new Promise<void>(resolve=>{if(child.exitCode!==null){resolve();return;}child.once('exit',()=>resolve());child.kill('SIGTERM');})));await rm(dir,{recursive:true,force:true}); }
