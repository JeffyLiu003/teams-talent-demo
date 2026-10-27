import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import type { ProjectWorkPlan } from '../src/project-work.js';
const dir=await mkdtemp(join(tmpdir(),'work-browser-')),origin='http://127.0.0.1:45978';
const stub=join(dir,'icode-probe');await writeFile(stub,`#!/usr/bin/env node
const args=process.argv.slice(2);if(args[0]==='--version')console.log('0.31.0-test');else if(args[0]==='agent')console.log(JSON.stringify({default:'Code',agents:[{name:'Code',id:'test-code',displayName:'Code',default:true,launchableAsMain:true,model:'active'}]}));else if(args[0]==='model')console.log(JSON.stringify({active:'test-model',models:[{id:'test-model',name:'Test Model'}]}));else {console.error('Probe refuses tool execution');process.exit(99);}
`);await chmod(stub,0o700);
const server=spawn(process.execPath,['--import','tsx','server/index.ts'],{env:{...process.env,DEMO_PORT:'45978',DEMO_TALENT_PORT:'45988',DEMO_STATE_DIR:dir,DEMO_TALENT_STATE_DIR:join(dir,'talent'),DEMO_NATIVE_DISABLED:'1',DEMO_ICODE_BINARY:stub},stdio:'pipe'});
let logs='';server.stderr.on('data',c=>logs+=c);let browser;
try{
  for(let n=0;n<100;n++){try{if((await fetch(origin+'/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  const before=await readFile(join(dir,'state.json'),'utf8');
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(10000);const errors:string[]=[],posts:any[]=[];page.on('pageerror',e=>errors.push(e.message));let fail=false;
  await page.route('**/api/project-work?*',async route=>{
    const u=new URL(route.request().url()),project=u.searchParams.get('projectId')!,tab=u.searchParams.get('tab')!,taskId=u.searchParams.get('taskId')??(project==='teams'?'T104':'DEMO-MKT-001'),nodeId=u.searchParams.get('nodeId')??'prepare';
    const plan:ProjectWorkPlan={target:{projectId:project,tab,taskId,nodeId},projectName:project==='teams'?'iCode Teams':'信用卡营销交付',title:project==='teams'?'契约测试':'信用卡消费返现',location:nodeId==='prepare'?'需求准备':nodeId==='verify'?'验证':'设计评审',source:'隔离 mock transport',planToken:'test-token-'+nodeId,instance:{terminal:{id:'system',name:'PowerShell'},installed:true,name:'本机 iCode',agent:'Code',agentLabel:'Code',model:'DeepSeek',modelLabel:'DeepSeek'},directory:{root:project==='teams'?null:'/isolated/carddemo',valid:project!=='teams',kind:'imported-snapshot',diagnostic:'尚未绑定本机目录'},context:{frozen:false,summary:'尚未冻结：使用当前准备资料',versions:'尚未冻结',selectedSkills:[],assets:[]},actions:[{id:'new',label:'新建当前工作的 iCode 会话',enabled:project!=='teams'}],defaultAction:'new'};
    await route.fulfill({json:plan});
  });
  await page.route('**/api/native/work-start',async route=>{const body=route.request().postDataJSON();posts.push(body);if(fail){await route.fulfill({status:409,json:{error:'目录配置已变化'}});return;}await new Promise(r=>setTimeout(r,150));await route.fulfill({json:{requestId:body.requestId,target:body.target,action:body.action,status:'terminal-requested',at:new Date().toISOString(),directory:'/isolated/project',sessionId:null,contextPath:'/isolated/context.md',instruction:'读取隔离测试上下文',terminal:'PowerShell',note:'已请求 PowerShell 打开对应工作目录；终端受理不等于模型执行。'}});});
  const visit=async(path:string)=>{await page.goto(origin+'/teams?demo-role=member#/'+path);await page.getByRole('button',{name:'iCode 作业',exact:true}).click();await page.getByRole('dialog').getByText('当前工作',{exact:true}).waitFor();};
  await visit('projects?tab=delivery&node=prepare');const modal=page.getByRole('dialog');await modal.getByText('MKT-001 · 需求准备',{exact:true}).waitFor();assert.match(await modal.innerText(),/尚未冻结/);await modal.locator('.ant-modal-close').click();assert.equal(posts.length,0);
  await page.getByRole('button',{name:'iCode 作业',exact:true}).click();await modal.getByRole('button',{name:'开始工作',exact:true}).dblclick();await modal.getByText('已请求进入 iCode 会话',{exact:true}).waitFor();assert.match(await modal.innerText(),/已请求 PowerShell/);assert.equal(posts.length,1);assert.equal(posts[0].role,'member');assert.deepEqual(posts[0].target,{projectId:'carddemo',tab:'delivery',taskId:'DEMO-MKT-001',nodeId:'prepare'});assert.equal(posts[0].action,'new');await modal.getByRole('button',{name:'完成',exact:true}).click();
  fail=true;await visit('projects?tab=delivery&node=prepare');await modal.getByRole('button',{name:'开始工作',exact:true}).click();await modal.getByRole('alert').filter({hasText:'目录配置已变化'}).waitFor();await modal.getByRole('button',{name:'重试原启动请求',exact:true}).click();await page.waitForTimeout(250);assert.equal(posts[1].requestId,posts[2].requestId);await modal.locator('.ant-modal-close').click();
  await visit('projects?project=teams&tab=delivery&task=T104&node=review');await modal.getByText('T104 · 设计评审',{exact:true}).waitFor();assert.equal(await modal.getByRole('button',{name:'开始工作',exact:true}).isDisabled(),true);assert.equal(await modal.getByRole('radio').count(),1);assert.equal(posts.length,3);
  await mkdir('test-results/project-work',{recursive:true});await page.waitForTimeout(350);await page.screenshot({path:'test-results/project-work/teams-binding.png',fullPage:true});await modal.locator('.ant-modal-close').click();
  fail=false;await visit('projects?tab=delivery&node=prepare');await page.waitForTimeout(350);await page.screenshot({path:'test-results/project-work/confirmation.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/project-work/confirmation-narrow.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await modal.locator('.ant-modal-close').click();await page.setViewportSize({width:1440,height:1000});
  // Current-tool launcher transport; no historical restore/focus capability is exposed.
  const agentPosts:any[]=[];
  const tools={terminalName:'PowerShell',terminals:[{id:'system',name:'PowerShell'}],selectedTerminal:'system',icode:{installed:true,path:'C:/Tools/icode.exe',version:'0.31.0',workspace:'C:/project',sessionId:'',sessionAvailable:false,active:null},opencode:{installed:true,path:'C:/Tools/opencode.exe',version:'1.0'},verification:null};
  await page.route('**/api/tools',route=>route.fulfill({json:tools}));
  await page.route('**/api/native/launch',async route=>{agentPosts.push(route.request().postDataJSON());await route.fulfill({json:{status:'terminal-requested',terminal:'PowerShell',note:'系统已创建 PowerShell 终端进程；工具启动或模型结果需在终端核对。'}});});
  await page.goto(origin+'/teams?demo-role=member#/agent');const agent=page.locator('#agent-management');
  await agent.locator('[data-start]').filter({hasText:'启动 iCode'}).waitFor();assert.equal(await agent.locator('[data-terminal] option:checked').innerText(),'PowerShell');await Promise.all([page.waitForResponse(response=>response.url().endsWith('/api/native/launch')),agent.locator('[data-start]').click()]);await agent.locator('[data-status]').filter({hasText:'系统已创建 PowerShell'}).waitFor();assert.equal(agentPosts.length,1);assert.equal(agentPosts[0].tool,'icode');assert.equal(agentPosts[0].restore,false);
  await agent.locator('[data-all]').click();await agent.locator('[data-results]').getByRole('button',{name:/OpenCode/}).click();await agent.locator('[data-start]').filter({hasText:'启动 OpenCode'}).waitFor();await Promise.all([page.waitForResponse(response=>response.url().endsWith('/api/native/launch')),agent.locator('[data-start]').click()]);await agent.locator('[data-status]').filter({hasText:'系统已创建 PowerShell'}).waitFor();assert.equal(agentPosts.length,2);assert.equal(agentPosts[1].tool,'opencode');
  await page.screenshot({path:'test-results/project-work/windows-terminal-entry.png',fullPage:true});
  // Actual isolated HTTP API guard (not routed through page mocks) rejects native side effects.
  const session=await (await fetch(origin+'/api/session')).json();
  for(const action of ['launch']){const response=await fetch(origin+'/api/native/'+action,{method:'POST',headers:{origin,'content-type':'application/json','x-demo-token':session.token},body:JSON.stringify({role:'member',tool:'icode',restore:false,requestId:'disabled-test-request'})});assert.equal(response.status,403);assert.match((await response.json()).error,/未开放本机启动/);}
  if(process.platform==='darwin') {
    const live=await browser.newPage({viewport:{width:1440,height:1000}});live.on('pageerror',e=>errors.push(e.message));
    await live.goto(origin+'/teams?demo-role=member#/agent');const panel=live.locator('#agent-management');await panel.locator('[data-terminal]').waitFor();
    const options=await panel.locator('[data-terminal] option').evaluateAll(nodes=>nodes.map(node=>(node as HTMLOptionElement).value));assert.ok(options.includes('ghostty'),'mac test requires installed Ghostty');
    await panel.locator('[data-terminal]').selectOption('ghostty');await live.waitForResponse(response=>response.url().endsWith('/api/tools'));await live.reload();await panel.locator('[data-terminal]').waitFor();assert.equal(await panel.locator('[data-terminal]').inputValue(),'ghostty');
    assert.deepEqual(JSON.parse(await readFile(join(dir,'terminal-preference.json'),'utf8')),{terminal:'ghostty'});
    await live.goto(origin+'/teams?demo-role=member#/projects?project=carddemo&tab=delivery&node=prepare');await live.getByRole('button',{name:'iCode 作业',exact:true}).click();const actual=live.getByRole('dialog');await actual.getByText('使用终端',{exact:true}).waitFor();await actual.getByText('Ghostty',{exact:true}).waitFor();
    await live.screenshot({path:'test-results/project-work/ghostty-shared-preference.png',fullPage:true});
    const change=await fetch(origin+'/api/native/terminal',{method:'POST',headers:{origin,'content-type':'application/json','x-demo-token':session.token},body:JSON.stringify({role:'member',terminal:'terminal'})});assert.equal(change.status,200);
    await actual.getByRole('button',{name:'开始工作',exact:true}).click();await actual.getByRole('alert').filter({hasText:'依据已变化'}).waitFor();
    await actual.locator('.ant-modal-close').click();await live.getByRole('button',{name:'iCode 作业',exact:true}).click();await actual.getByText('Terminal',{exact:true}).waitFor();await actual.locator('.ant-modal-close').click();
    const bad=await fetch(origin+'/api/native/terminal',{method:'POST',headers:{origin,'content-type':'application/json','x-demo-token':session.token},body:JSON.stringify({role:'member',terminal:'missing'})});assert.equal(bad.status,500);assert.match((await bad.json()).error,/不可用/);
    assert.deepEqual(JSON.parse(await readFile(join(dir,'terminal-preference.json'),'utf8')),{terminal:'terminal'});await live.close();
  }
  assert.equal(await readFile(join(dir,'state.json'),'utf8'),before);assert.deepEqual(errors,[]);await writeFile('test-results/project-work/browser-results.json',JSON.stringify({passed:true,posts,agentPosts,windowsUIContract:true,nativeDisabledAPI:true,errors,nativeInvocations:0,stateUnchanged:true},null,2));console.log('Project work modal browser passed; 0 real native invocations');
}catch(error){console.error(logs);throw error;}finally{await browser?.close();server.kill('SIGTERM');await new Promise<void>(resolve=>server.once('exit',()=>resolve()));await rm(dir,{recursive:true,force:true});}
