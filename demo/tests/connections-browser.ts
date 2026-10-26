import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initialState } from '../src/domain.js';

const origin='http://127.0.0.1:45974',dir=await mkdtemp(join(tmpdir(),'teams-source-data-')),output='test-results/source-data';
await mkdir(output,{recursive:true});
const initial=initialState();initial.workspace.connections.find(item=>item.id==='requirements')!.enabled=false;
await writeFile(join(dir,'state.json'),JSON.stringify(initial));
const server=spawn(process.execPath,['--import','tsx','server/index.ts'],{env:{...process.env,DEMO_PORT:'45974',DEMO_TALENT_PORT:'45984',DEMO_STATE_DIR:dir,DEMO_TALENT_STATE_DIR:join(dir,'talent'),DEMO_NATIVE_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
let logs='';server.stdout.on('data',chunk=>logs+=chunk);server.stderr.on('data',chunk=>logs+=chunk);
let browser;
try{
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}assert.ok(ready,logs);
  const before=await readFile(join(dir,'state.json'),'utf8'),errors:string[]=[],writes:string[]=[],layouts:unknown[]=[];
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(8000);
  page.on('pageerror',error=>errors.push(error.message));await page.route('**/api/**',route=>{if(route.request().method()==='POST'){writes.push(route.request().url());return route.abort();}return route.continue();});
  let knowledgePhase:'not-built'|'ready'|'error'='not-built';
  const knowledgeAsset={id:'business-knowledge:carddemo:ui-test-rules',pluginId:'business-knowledge',sourceRecordId:'ui-test-rules',kind:'knowledge',title:'餐饮返现业务知识 · API夹具',summary:'由测试响应提供的已构建知识资产。',detail:'Talent mock 知识资产；此数据仅用于验证连接页面的API读取行为。',sourceProjectId:'carddemo',sourceProjectName:'信用卡营销交付',origin:'plugin-mock',version:'knowledge-v1',references:[],relatedRequirementIds:[]};
  await page.route('**/api/knowledge/assets*',route=>route.fulfill({status:knowledgePhase==='error'?503:200,headers:{'content-type':'application/json','access-control-allow-origin':origin,'access-control-allow-headers':'*'},body:JSON.stringify(knowledgePhase==='error'?{error:'Talent 服务暂不可用（测试）'}:{assets:knowledgePhase==='ready'?[knowledgeAsset]:[],projects:[{id:'carddemo',name:'信用卡营销交付',status:knowledgePhase==='ready'?'ready':'not-built'},{id:'teams',name:'iCode Teams',status:'not-built'}],origin:'isolated-test-response'})}));
  await page.goto(origin+'/teams#/connections');await page.getByRole('button',{name:'查看代码托管平台数据',exact:true}).waitFor();
  assert.equal(await page.locator('.enterprise-plugin-card').count(),6);
  assert.equal(await page.locator('[data-platform="requirements"]').getByRole('button',{name:'在项目中使用',exact:true}).isEnabled(),false);
  const checks=[
    ['repository','代码托管平台','CardDemo Java 项目','carddemo-java-1025',6],
    ['requirements','需求平台','餐饮消费返现','DEMO-MKT-001',7],
    ['defects','缺陷平台','未报名时应提供餐饮活动报名入口','CARD-BUG-001',3],
    ['design-library','设计文档 / 知识库','营销能力设计','marketing-capability',7],
    ['test-assets','测试资产平台','餐饮活动报名与未报名消费','CARD-TC-01',8],
  ] as const;
  for(const [id,name,title,record,count] of checks){
    await page.getByRole('button',{name:'查看'+name+'数据',exact:true}).click();const drawer=page.locator('.enterprise-source-drawer');await drawer.getByRole('button',{name:title,exact:true}).waitFor();
    assert.equal(await drawer.locator('.ant-table-row').count(),count);await drawer.getByText('信用卡营销交付',{exact:true}).first().waitFor();await drawer.getByText('iCode Teams',{exact:true}).first().waitFor();
    await drawer.getByRole('button',{name:title,exact:true}).click();await drawer.getByRole('heading',{name:title,exact:true}).waitFor();await drawer.getByText(record,{exact:true}).waitFor();
    assert.ok((await drawer.locator('.enterprise-source-detail').innerText()).includes('插件 mock 记录'));
    if(id==='design-library'){await drawer.getByRole('button',{name:'阅读营销能力设计',exact:true}).click();await drawer.locator('.enterprise-source-reference pre').waitFor();assert.ok((await drawer.locator('.enterprise-source-reference pre').innerText()).includes('营销'));}
    if(id==='test-assets')assert.ok((await drawer.locator('.enterprise-source-detail').innerText()).includes('预期结果'));
    await page.screenshot({path:output+'/'+id+'-detail.png',fullPage:true,animations:'disabled'});await drawer.getByRole('button',{name:'返回数据',exact:true}).click();await drawer.locator('.ant-table-row').first().waitFor();await drawer.locator('.ant-drawer-close').click();await drawer.waitFor({state:'hidden'});
  }
  await page.getByRole('button',{name:'查看业务知识（Talent）数据',exact:true}).click();let knowledgeDrawer=page.locator('.enterprise-source-drawer');await knowledgeDrawer.getByText('暂无已构建的业务知识资产。',{exact:true}).waitFor();assert.equal(await knowledgeDrawer.locator('.ant-table-row').count(),0);
  await knowledgeDrawer.getByRole('combobox',{name:'业务知识来源项目'}).click();await page.locator('.ant-select-item-option-content').getByText('iCode Teams · 未构建',{exact:true}).click();await knowledgeDrawer.getByText('此项目尚未构建业务知识。',{exact:true}).waitFor();
  const talentHref=await knowledgeDrawer.getByRole('link',{name:'在 Talent 查看 / 构建',exact:true}).getAttribute('href');assert.ok(talentHref);assert.notEqual(new URL(talentHref).origin,origin);assert.ok(new URL(talentHref).hash.includes('project=teams'));assert.ok(!new URL(talentHref).hash.includes('DEMO-MKT-001'));await page.screenshot({path:output+'/knowledge-not-built.png',fullPage:true,animations:'disabled'});
  await knowledgeDrawer.locator('.ant-drawer-close').click();await knowledgeDrawer.waitFor({state:'hidden'});
  knowledgePhase='ready';await page.getByRole('button',{name:'查看业务知识（Talent）数据',exact:true}).click();knowledgeDrawer=page.locator('.enterprise-source-drawer');await knowledgeDrawer.getByRole('button',{name:knowledgeAsset.title,exact:true}).click();await knowledgeDrawer.getByRole('heading',{name:knowledgeAsset.title,exact:true}).waitFor();await page.screenshot({path:output+'/knowledge-ready.png',fullPage:true,animations:'disabled'});await knowledgeDrawer.locator('.ant-drawer-close').click();await knowledgeDrawer.waitFor({state:'hidden'});
  knowledgePhase='error';await page.getByRole('button',{name:'查看业务知识（Talent）数据',exact:true}).click();knowledgeDrawer=page.locator('.enterprise-source-drawer');await knowledgeDrawer.getByText('业务知识读取失败',{exact:true}).waitFor();assert.equal(await knowledgeDrawer.locator('.ant-table-row').count(),0);await page.screenshot({path:output+'/knowledge-error.png',fullPage:true,animations:'disabled'});
  knowledgePhase='ready';await knowledgeDrawer.getByRole('button',{name:'重新读取业务知识',exact:true}).click();await knowledgeDrawer.getByRole('button',{name:knowledgeAsset.title,exact:true}).waitFor();await knowledgeDrawer.locator('.ant-drawer-close').click();await knowledgeDrawer.waitFor({state:'hidden'});
  for(const mode of ['light','dark'])for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});await page.evaluate(value=>localStorage.setItem('carddemo-theme',value),mode);await page.reload();await page.getByRole('button',{name:'查看测试资产平台数据',exact:true}).waitFor();
    let measure=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));assert.ok(measure.scrollWidth<=width);layouts.push({mode,page:'cards',...measure});
    await page.screenshot({path:output+'/'+mode+'-'+width+'-cards.png',fullPage:true,animations:'disabled'});
    await page.getByRole('button',{name:'查看测试资产平台数据',exact:true}).click();const drawer=page.locator('.enterprise-source-drawer');await drawer.getByRole('button',{name:'餐饮活动报名与未报名消费',exact:true}).click();
    await drawer.locator('.enterprise-source-detail').waitFor();measure=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));assert.ok(measure.scrollWidth<=width);layouts.push({mode,page:'detail',...measure});
    await page.screenshot({path:output+'/'+mode+'-'+width+'-detail.png',fullPage:true,animations:'disabled'});await drawer.locator('.ant-drawer-close').click();await drawer.waitFor({state:'hidden'});
  }
  await page.getByRole('combobox',{name:'切换演示角色'}).click();await page.locator('.ant-select-item-option-content').getByText('陈晨 · 项目成员',{exact:true}).click();await page.getByText('此页面面向项目 Owner',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'查看需求平台数据',exact:true}).count(),0);
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.deepEqual(await(await fetch(origin+'/api/state')).json(),initial);assert.equal(await readFile(join(dir,'state.json'),'utf8'),before);
  await writeFile(output+'/result.json',JSON.stringify({passed:true,plugins:[...checks.map(([id])=>id),'business-knowledge'],knowledgeApiFixtures:['not-built','ready','error','retry'],layouts,pageErrors:errors,posts:writes,stateUnchanged:true,memberGuard:true},null,2));console.log('PASS: 6 source plugin drawers, knowledge API empty/ready/error/retry, local reference, read-only state, role guard, 8 layouts');
}catch(error){await writeFile(output+'/failure.log',String(error)+'\n'+logs);throw error;}finally{await browser?.close();server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));await rm(dir,{recursive:true,force:true});}
