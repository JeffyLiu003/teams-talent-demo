import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { initialState } from '../src/domain.js';
import { updateWorkspace } from '../src/workspace.js';
import { readFixtures } from '../server/http-shared.js';
import { ProjectWorkService, resolveProjectWork, type WorkTransport } from '../server/project-work.js';
import { sessionId, workspace } from '../server/config.js';
const fixtures = await readFixtures();
function transport() {
  const calls: any[] = []; let active = false, fail = false;
  const value: WorkTransport = { defaults: async () => ({agent:'role',agentLabel:'Code',model:'model',modelLabel:'Model'}), history: async () => ({available:true,directory:workspace,title:'history',configuration:{agent:'original-role',agentLabel:'Original',model:'original-model',modelLabel:'Original model'},active:active?{pid:123,application:'Ghostty',tty:'ttys123',terminal:{id:'surface',title:'history',directory:workspace}}:null}), start: async input => { calls.push(input); if(fail)throw new Error('transport uncertain'); }, focus:async input=>{calls.push(input);return {status:'terminal-focused',note:'focused known terminal'};} };
  return {value,calls,setActive:()=>active=true,setFail:()=>fail=true};
}
test('work resolves precise Card/Teams/new-project scope and does not substitute Card history', async () => {
  const dir=await mkdtemp(join(tmpdir(),'work-scope-')), t=transport();let state=initialState();
  try {
    const service=new ProjectWorkService(()=>state,fixtures,dir,t.value), before=JSON.stringify(state);
    const plan=await service.plan('member',{projectId:'carddemo',tab:'delivery',nodeId:'prepare'});
    assert.equal(plan.target.taskId,'DEMO-MKT-001');assert.equal(plan.context.frozen,false);assert.equal(plan.defaultAction,'new');assert.equal(plan.history?.sessionId,sessionId);
    const teams=await service.plan('owner',{projectId:'teams',tab:'delivery',taskId:'T104',nodeId:'review'});
    assert.equal(teams.target.taskId,'T104');assert.equal(teams.history,undefined);assert.equal(teams.actions[0].enabled,false);
    assert.throws(()=>resolveProjectWork(state,fixtures,{projectId:'teams',tab:'delivery',taskId:'DEMO-MKT-001'}),/不存在/);
    assert.equal(JSON.stringify(state),before);assert.equal(t.calls.length,0);
    const p={id:randomUUID(),name:'New',description:'',remoteUrl:'https://github.com/example/new.git',repositoryIdentity:'github.com/example/new'};
    state=updateWorkspace(state,'project.create','owner',p);
    const created=await service.plan('member',{projectId:p.id,tab:'content'});assert.equal(created.history,undefined);assert.equal(created.target.taskId,undefined);assert.equal(created.directory.valid,false);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('one confirmation pins scope/config, repeated request does not launch again, changed basis is rejected', async () => {
  const dir=await mkdtemp(join(tmpdir(),'work-start-')), t=transport();let state=initialState();
  try {
    const service=new ProjectWorkService(()=>state,fixtures,dir,t.value), before=JSON.stringify(state), plan=await service.plan('member',{projectId:'carddemo',tab:'delivery',nodeId:'develop'});
    const body={requestId:randomUUID(),target:plan.target,action:'new' as const,planToken:plan.planToken};
    const [one,two]=await Promise.all([service.start('member',body),service.start('member',body)]);assert.deepEqual(one,two);assert.equal(t.calls.length,1);assert.equal(one.sessionId,null);assert.equal(t.calls[0].agent,'role');assert.equal(t.calls[0].sessionId,undefined);
    const context=await readFile(one.contextPath,'utf8');assert.match(context,/DEMO-MKT-001/);assert.match(context,/develop/);assert.match(context,/teams-demo-collaboration/);assert.match(context,/context.*get/);assert.equal(JSON.stringify(state),before);
    await assert.rejects(service.start('member',{...body,action:'resume'}),/另一项/);
    state={...state,revision:state.revision+1};await assert.rejects(service.start('member',{...body,requestId:randomUUID()}),/依据已变化/);
    assert.equal(t.calls.length,1);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('active historical session enters a verified terminal, never launches a duplicate; uncertainty is retained',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'work-history-')), t=transport(),state=initialState();t.setActive();
  try{
    const service=new ProjectWorkService(()=>state,fixtures,dir,t.value),plan=await service.plan('owner',{projectId:'carddemo',tab:'delivery',nodeId:'prepare'});
    assert.ok(plan.actions.find(a=>a.id==='focus')?.enabled);assert.equal(plan.actions.some(a=>a.id==='resume'),false);
    const receipt=await service.start('owner',{requestId:randomUUID(),target:plan.target,action:'focus',planToken:plan.planToken});assert.equal(receipt.status,'terminal-focused');assert.equal(t.calls[0].active.pid,123);
    t.setFail();const body={requestId:randomUUID(),target:plan.target,action:'new' as const,planToken:plan.planToken};await assert.rejects(service.start('owner',body),/待核对/);const again=await service.start('owner',body);assert.equal(again.status,'uncertain');assert.equal(t.calls.length,2);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('directory binding is role/project scoped, verifies Git origin, and rejects reference checkout',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'work-bind-')), repo=join(dir,'repo'),wrong=join(dir,'wrong'),reference=join(dir,'reference'), t=transport();let state=initialState();
  try{
    await mkdir(reference);
    for(const path of [repo,wrong]){await mkdir(path);execFileSync('git',['init','-q',path]);execFileSync('git',['-C',path,'remote','add','origin',path===repo?'https://github.com/example/new.git':'https://github.com/example/wrong.git']);}
    const p={id:randomUUID(),name:'New',description:'',remoteUrl:'https://github.com/example/new.git',repositoryIdentity:'github.com/example/new'};state=updateWorkspace(state,'project.create','owner',p);const before=JSON.stringify(state);
    const service=new ProjectWorkService(()=>state,{...fixtures,baseline:{...fixtures.baseline,sourceRoot:reference}},dir,t.value),target={projectId:p.id,tab:'content'};
    await assert.rejects(service.bind('member',target,wrong),/origin/);await assert.rejects(service.bind('member',target,reference),/只读/);
    const withoutReference = new ProjectWorkService(()=>state,{...fixtures,baseline:{...fixtures.baseline,sourceRoot:join(dir,'reference-not-shipped')}},join(dir,'relocated-state'),t.value);
    assert.equal((await withoutReference.bind('member',target,repo)).directory.valid,true);
    assert.equal((await service.bind('member',target,repo)).directory.valid,true);assert.equal((await service.plan('owner',target)).directory.valid,false);
    const plan=await service.plan('member',target);const receipt=await service.start('member',{requestId:randomUUID(),target,action:'new',planToken:plan.planToken});assert.equal(receipt.directory,await realpath(repo));assert.equal(receipt.sessionId,null);assert.equal(JSON.stringify(state),before);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('resume retains historical directory, session and role/model instead of current defaults',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'work-resume-')),t=transport(),state=initialState();
  try {const service=new ProjectWorkService(()=>state,fixtures,dir,t.value),plan=await service.plan('member',{projectId:'carddemo',tab:'delivery',nodeId:'prepare'});await service.start('member',{requestId:randomUUID(),target:plan.target,action:'resume',planToken:plan.planToken});assert.equal(t.calls[0].directory,workspace);assert.equal(t.calls[0].sessionId,sessionId);assert.equal(t.calls[0].agent,'original-role');assert.equal(t.calls[0].model,'original-model');}finally{await rm(dir,{recursive:true,force:true});}
});
