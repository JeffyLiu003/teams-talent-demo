import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp,mkdir,readFile,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
const dir=await mkdtemp(join(tmpdir(),'delivery-scoped-')),teams='http://127.0.0.1:46193',talent='http://127.0.0.1:46194';
const env={...process.env,DEMO_PORT:'46193',DEMO_TALENT_PORT:'46194',DEMO_STATE_DIR:join(dir,'teams'),DEMO_TALENT_STATE_DIR:join(dir,'talent'),DEMO_NATIVE_DISABLED:'1'};
let logs='';const start=(entry:string)=>{const child=spawn(process.execPath,['--import','tsx',entry],{env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);return child;};const server=start('server/index.ts');let receiver=start('server/talent.ts');
const state=async()=>await(await fetch(teams+'/api/state')).json() as any;
const wait=async(check:()=>Promise<boolean>)=>{for(let i=0;i<100;i++){try{if(await check())return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Timed out: '+logs);};
const post=async(base:string,path:string,body:object,expected=200)=>{const {token}=await(await fetch(base+'/api/session')).json() as any;const response=await fetch(base+path,{method:'POST',headers:{origin:base,'content-type':'application/json','x-demo-token':token},body:JSON.stringify({role:'owner',revision:(await state()).revision,...body})});const value=await response.json();assert.equal(response.status,expected,JSON.stringify(value));return value;};
const context=async(taskId:string,nodeId:string)=>await(await fetch(teams+'/api/collaboration/context?'+new URLSearchParams({projectId:'carddemo',taskId,nodeId}))).json() as any;
const automation=(s:any,id:string)=>s.workspace.taskAutomation?.find((r:any)=>r.taskId===id);
try{
 await wait(async()=>(await fetch(teams+'/api/health')).ok&&(await fetch(talent+'/api/health')).ok);
 const original=await state();
 const ids=['MKT-E2E-TEST-001','MKT-E2E-TEST-002'];
 for(const id of ids)await post(teams,'/api/delivery-requirements',{action:'create',input:{projectId:'carddemo',id,title:'独立任务 '+id,description:'白金卡、3个月、额外0.5%；其余政策未定。',assigneeId:'member',skillIds:['dev-frontend-ui','dev-code-reviewer']}});
 for(const taskId of ids)await post(talent,'/api/task-inputs/register',{projectId:'carddemo',taskId});
 const current=(id:string,s:any)=>s.workspace.deliveryRequirements.find((t:any)=>t.id===id);
 const receipts:any[]=[];
 for(const [index,id] of ids.entries()){
  const scope={projectId:'carddemo',taskId:id};const sessionId='test-protocol-session-'+index,runId=randomUUID();
  await post(teams,'/api/task-automation',{...scope,step:'knowledge',role:'member'});assert.equal(automation(await state(),id).knowledge.status,'ready');
  for(const nodeId of ['prepare','develop','verify']){
   const c=await context(id,nodeId);assert.equal(c.agreement.id,id);assert.equal(c.talentInputs.taskId,id);assert.ok(c.skills.every((skill:any)=>skill.availability==='talent-registered-asset'));const input={...scope,nodeId,sessionId,runId,expectedRevision:c.revision,basisDigest:c.basisDigest,readReferences:c.skills.map((skill:any)=>skill.id)};
   const adopted=await post(teams,'/api/collaboration',{role:'member',kind:'inputs.adopt',operationId:randomUUID(),input});if(nodeId==='prepare')continue;
   const progress=async(kind:string,extra:object)=>post(teams,'/api/collaboration',{role:'member',kind,operationId:randomUUID(),input:{...scope,nodeId,sessionId,runId,adoptionId:adopted.receipt.adoptionId,expectedRevision:(await state()).revision,summary:'协议验证 '+nodeId,evidence:[{kind:'local-file',value:'tests/delivery-requirements-http.ts',description:'仅接口测试，不代表真实iCode执行'}],...extra}});
   await progress('progress.add',{phase:'started'});
   if(nodeId==='verify'){
    await progress('result.submit',{checks:[{status:'failed',source:'actual',summary:'接口测试记录一次失败，不代表真实iCode执行'},{status:'passed',source:'preset',summary:'另一项预置检查通过'}]});
    const blocked=current(id,await state());assert.equal(blocked.stage,'verifying');assert.equal(blocked.nodes.verify.status,'blocked');
    await post(teams,'/api/delivery-requirements',{...scope,action:'accept'},409);
   }
   await progress('result.submit',nodeId==='verify'?{checks:[{status:'passed',source:'preset',summary:'预置复检通过，仅验证接口状态管理'}]}:{});
  }
  const task=current(id,await state());assert.equal(task.stage,'awaiting-acceptance');assert.equal(task.nodes.prepare.status,'complete');assert.equal(task.nodes.develop.status,'complete');assert.equal(task.nodes.verify.status,'complete');assert.equal(task.checks.length,3);
  assert.equal(automation(await state(),id).collection,undefined);
  await post(teams,'/api/delivery-requirements',{...scope,action:'accept',role:'member'},403);
 }
 // Returning one task must invalidate its prior checks without changing another task.
 const returnScope={projectId:'carddemo',taskId:ids[0]},other=structuredClone(current(ids[1],await state()));
 const history=structuredClone(current(ids[0],await state()).checks);
 await post(teams,'/api/delivery-requirements',{...returnScope,action:'return',reason:'补充边界验证'});
 for(const nodeId of ['develop','verify']){
  const c=await context(ids[0],nodeId),runId=randomUUID(),sessionId='test-protocol-session-0';
  const adopted=await post(teams,'/api/collaboration',{role:'member',kind:'inputs.adopt',operationId:randomUUID(),input:{...returnScope,nodeId,sessionId,runId,expectedRevision:c.revision,basisDigest:c.basisDigest,readReferences:c.skills.map((skill:any)=>skill.id)}});
  const result=async(checks?:unknown,expected=200)=>post(teams,'/api/collaboration',{role:'member',kind:'result.submit',operationId:randomUUID(),input:{...returnScope,nodeId,sessionId,runId,adoptionId:adopted.receipt.adoptionId,expectedRevision:(await state()).revision,summary:'退回后补充',evidence:[{kind:'reference',value:'protocol-check',description:'仅接口测试'}],...(checks?{checks}:{})}},expected);
  if(nodeId==='develop')await result();else{
   await result(undefined,409);assert.equal(current(ids[0],await state()).stage,'verifying');assert.deepEqual(current(ids[0],await state()).checks,history);
   await result([{status:'passed',source:'preset',summary:'新一轮检查通过，仅接口测试'}]);
  }
 }
 assert.deepEqual(current(ids[1],await state()),other);assert.equal(current(ids[0],await state()).stage,'awaiting-acceptance');
 // Main record stays awaiting Owner; the second independent task exercises actual receiving + retry.
 const acceptanceScope={projectId:'carddemo',taskId:ids[1]};await new Promise<void>(resolve=>{receiver.once('exit',()=>resolve());receiver.kill('SIGTERM');});
 await post(teams,'/api/delivery-requirements',{...acceptanceScope,action:'accept'});await wait(async()=>automation(await state(),ids[1]).collection?.reporting?.status==='failed');assert.equal(current(ids[1],await state()).stage,'accepted');
 receiver=start('server/talent.ts');await wait(async()=>(await fetch(talent+'/api/health')).ok);
 await post(teams,'/api/task-automation',{...acceptanceScope,step:'collection',retry:true});const uploaded=automation(await state(),ids[1]).collection;assert.equal(uploaded.reporting.status,'reported');assert.deepEqual(uploaded.reporting.receipt.sessionIds,['test-protocol-session-1']);receipts.push(uploaded.reporting.receipt);
 await post(teams,'/api/task-automation',{...acceptanceScope,step:'collection',retry:true});assert.deepEqual(automation(await state(),ids[1]).collection.reporting.receipt,uploaded.reporting.receipt);
 const talentState=JSON.parse(await readFile(join(dir,'talent/talent-state.json'),'utf8'));assert.equal(talentState.taskIntakes.length,1);assert.equal(talentState.taskIntakes[0].payload.taskId,ids[1]);assert.equal(current(ids[0],await state()).stage,'awaiting-acceptance');
 const after=await state();for(const key of ['knowledge','assigned','assigneeId','stage','checks','context','transactions','evolution','security'])assert.deepEqual(after[key],original[key],key+' leaked between tasks');assert.equal(after.workspace.sessionReported,original.workspace.sessionReported);
 await mkdir('test-results/delivery-requirements',{recursive:true});await writeFile('test-results/delivery-requirements/http-result.json',JSON.stringify({passed:true,realICode:false,scope:'HTTP protocol and persistence only',tasks:after.workspace.deliveryRequirements,receipts,existingTaskUnchanged:true},null,2));console.log('PASS scoped requirements, actual Talent input/receive, CLI phase/check gates, failed upload retry and exact persistence');
}catch(error){console.error(logs);throw error;}finally{for(const child of [server,receiver])if(child.exitCode===null)await new Promise<void>(resolve=>{child.once('exit',()=>resolve());child.kill('SIGTERM');});await rm(dir,{recursive:true,force:true});}
