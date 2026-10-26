import { chromium, type Page } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initialState } from '../src/domain.js';

const origin = 'http://127.0.0.1:45973', dir = await mkdtemp(join(tmpdir(), 'teams-create-e2e-'));
const talentOrigin = 'http://127.0.0.1:45983';
const legacy = initialState(); legacy.knowledge = true; legacy.revision = 1;
await writeFile(join(dir, 'state.json'), JSON.stringify(legacy));
const serviceEnv = { ...process.env, DEMO_PORT: '45973', DEMO_TALENT_PORT: '45983', DEMO_STATE_DIR: dir, DEMO_TALENT_STATE_DIR: join(dir, 'talent'), DEMO_NATIVE_DISABLED: '1' };
const server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { env: serviceEnv, stdio: ['ignore', 'pipe', 'pipe'] });
const talent = spawn(process.execPath, ['--import', 'tsx', 'server/talent.ts'], { env: serviceEnv, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = ''; server.stdout.on('data', c => logs += c); server.stderr.on('data', c => logs += c);
talent.stdout.on('data', c => logs += c); talent.stderr.on('data', c => logs += c);
await mkdir('test-results', { recursive: true });
let browser, page: Page | undefined;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + '/api/health')).ok && (await fetch(talentOrigin + '/api/health')).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); }
  assert.ok(ready, logs);
  const bootstrap = await (await fetch(origin + '/api/bootstrap')).json() as any;
  const state = async () => await (await fetch(origin + '/api/state')).json() as any;
  const initial = await state(), headers = { 'content-type': 'application/json', 'x-demo-token': bootstrap.token, origin };
  const draft = { id: randomUUID(), name: '客户服务门户', description: '独立项目说明', remoteUrl: 'https://github.com/example/customer-portal.git', repositoryIdentity: 'github.com/example/customer-portal' };
  const request = async (role: string, kind: string, payload: unknown) => fetch(origin + '/api/workspace', { method: 'POST', headers, body: JSON.stringify({ role, kind, payload, revision: (await state()).revision }) });
  assert.equal((await request('member', 'project.create', draft)).status, 403);
  assert.equal((await request('owner', 'project.create', { ...draft, name: '' })).status, 400);
  assert.deepEqual(await state(), initial);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); page.setDefaultTimeout(7000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const visit = async (path: string) => { await page!.goto(origin + '/teams#/' + path); await page!.getByRole('button', { name: '使用指引' }).waitFor(); };
  const closePanels = async (target = page!) => { for (const selector of ['.owner-project-panel', '.project-knowledge-drawer']) { const panel = target.locator(selector); if (await panel.isVisible()) { await panel.locator('.ant-drawer-close').click(); await panel.waitFor({ state: 'hidden' }); } } };
  const openPanel = async (name: string, target = page!) => { await closePanels(target); await target.getByRole('button', { name, exact: true }).click(); };
  const closeText = async (target = page!) => { await target.locator('.ant-drawer').filter({ has: target.locator('.drawer-console') }).locator('.ant-drawer-close').click(); await target.locator('.drawer-console').waitFor({ state: 'hidden' }); };
  const save = async (kind: string, name: string) => { const [response] = await Promise.all([page!.waitForResponse(r => r.url() === origin + '/api/workspace' && r.request().postDataJSON().kind === kind), page!.getByRole('button', { name, exact: true }).click()]); assert.equal(response.status(), 200, await response.text()); };
  await visit('projects?project=carddemo&tab=content'); await openPanel('知识成果');
  await page.locator('.project-knowledge').getByText('尚未生成项目知识', { exact: true }).waitFor();
  assert.equal(await page.locator('[data-action="knowledge"]').isEnabled(), true, 'legacy Teams projection must not disable actual Talent build');
  const [built] = await Promise.all([page.waitForResponse(response => response.url() === talentOrigin + '/api/action'), page.locator('[data-action="knowledge"]').click()]); assert.equal(built.status(), 200);
  await page.getByRole('button', { name: '查看项目知识：报名与资格分别判断', exact: true }).waitFor();
  assert.deepEqual(await state(), initial, 'same-revision legacy projection stays unchanged while actual results refresh');
  await visit('projects?tab=list');
  await page.getByRole('button', { name: '添加项目', exact: true }).click();
  await page.screenshot({ path: 'test-results/project-create-form.png' });
  await page.getByRole('button', { name: '创建项目', exact: true }).click();
  await page.getByText('请填写项目名称', { exact: true }).waitFor(); assert.deepEqual(await state(), initial);
  await page.getByRole('textbox', { name: '项目名称', exact: true }).fill(draft.name);
  await page.getByRole('textbox', { name: '项目说明', exact: true }).fill(draft.description);
  await page.getByRole('textbox', { name: '代码仓地址', exact: true }).fill(draft.remoteUrl);
  await page.getByRole('textbox', { name: '代码仓标识（主机/组织/仓库）', exact: true }).fill(draft.repositoryIdentity);
  await save('project.create', '创建项目');
  await page.locator('.breadcrumb strong').getByText(draft.name, { exact: true }).waitFor();
  let created = await state(); const projectId = created.workspace.projects[0].id;
  assert.ok(!['carddemo', 'teams'].includes(projectId));
  const business = (value: any) => { const copy = structuredClone(value); delete copy.workspace.projects; copy.revision = 0; copy.audit = []; return copy; };
  assert.deepEqual(business(created), business(initial));
  await openPanel('项目资料'); await page.getByText('尚未关联项目资料', { exact: true }).waitFor(); await closePanels(); await openPanel('知识成果');
  assert.equal(await page.locator('.created-project [data-action]:not([data-action="knowledge"])').count(), 0);
  assert.equal(await page.locator('[data-action="knowledge"]').isDisabled(), true); await closePanels();
  await page.screenshot({ path: 'test-results/project-create-content.png' });
  await page.reload(); await page.locator('.breadcrumb strong').getByText(draft.name, { exact: true }).waitFor();
  const empty = [['任务管理', '尚未创建任务'], ['任务交付', '尚无可交付任务'], ['发布跟踪', '尚未登记发布版本']];
  for (const [tab, text] of empty) { await page.getByRole('tab', { name: tab, exact: true }).click(); await page.getByText(text, { exact: true }).waitFor(); }
  await page.getByRole('button', { name: '项目设置', exact: true }).click();
  await page.getByRole('textbox', { name: '项目名称', exact: true }).fill('客户门户新版'); await save('project.metadata.update', '保存项目信息');
  await page.locator('.breadcrumb strong').getByText('客户门户新版', { exact: true }).waitFor();
  await visit('projects?tab=list'); await page.getByRole('button', { name: '进入项目：客户门户新版', exact: true }).waitFor();
  await page.locator('.framework-sidebar').getByRole('link', { name: '客户门户新版', exact: true }).click();
  await page.locator('.breadcrumb strong').getByText('客户门户新版', { exact: true }).waitFor();
  await page.getByRole('button', { name: '切换到深色模式' }).click();
  for (const width of [1440, 390]) { await page.setViewportSize({ width, height: 1000 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({ path: `test-results/project-create-dark-${width}.png` }); }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await visit('projects?project=carddemo&tab=content'); await page.locator('.breadcrumb strong').getByText(initial.workspace.project.name, { exact: true }).waitFor(); await openPanel('项目资料'); await page.getByRole('button', { name: '关联项目资产' }).waitFor();
  await visit('projects?project=teams&tab=content'); await page.locator('.breadcrumb strong').getByText('iCode Teams', { exact: true }).waitFor(); await openPanel('项目资料'); await page.getByRole('button', { name: '查看 AGENTS.md', exact: true }).waitFor();
  const member = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); await member.addInitScript(() => localStorage.setItem('carddemo-role', 'member'));
  await member.goto(origin + '/teams#/projects?tab=list'); await member.getByRole('button', { name: '使用指引' }).waitFor(); assert.equal(await member.getByRole('button', { name: '添加项目', exact: true }).count(), 0);
  await member.goto(origin + '/teams#/projects?project=' + projectId + '&tab=settings'); await member.getByText('项目成员可查看基础信息，由 Owner 维护。', { exact: true }).waitFor(); assert.equal(await member.getByRole('textbox', { name: '项目名称', exact: true }).isDisabled(), true);
  assert.equal((await request('member', 'project.metadata.update', { ...draft, id: projectId, name: '越权更新' })).status, 403);
  await closePanels(); await page.getByRole('button', { name: '切换到浅色模式' }).click();
  const sharedTitles = ['项目基础信息', '项目资料与资产', '项目知识成果', '需求材料与来源', '项目可用 Skill'];
  const layoutChecks: unknown[] = [];
  for (const [roleName, target] of [['owner', page], ['member', member]] as const) for (const id of ['carddemo', 'teams', projectId]) {
    await target.goto(origin + '/teams#/projects?project=' + id + '&tab=content');
    if (roleName === 'owner') {
      await target.locator('.project-owner-overview').waitFor(); assert.equal(await target.locator('[data-metric]').count(), 6);
      await openPanel('知识成果', target); if (id !== 'carddemo') await target.getByText('尚未生成项目知识', { exact: true }).waitFor(); await closePanels(target);
      await openPanel('项目资料', target);
    } else { await target.locator('.project-content-template').waitFor(); assert.deepEqual(await target.locator('.project-content-template h2').allTextContents(), sharedTitles); if (id !== 'carddemo') await target.getByText('尚未生成项目知识', { exact: true }).waitFor(); }
    if (id === 'teams') { assert.equal(await target.getByRole('button', { name: '关联项目资产', exact: true }).count(), 0); await target.getByRole('button', { name: '项目成员与职责', exact: true }).click(); await target.getByText('成员 A、B、C 为项目协作成员。', { exact: false }).waitFor(); }
    if (roleName === 'owner') await openPanel('查看 Skill', target);
    if (id === 'teams') for (const skill of bootstrap.data.teamsProject.project.skills) { await target.getByRole('button', { name: '查看 Skill：' + skill.name, exact: true }).click(); const original = bootstrap.data.teamsProject.documents.find((doc: any) => doc.path === '.agents/skills/' + skill.name + '/SKILL.md').content; assert.ok((await target.locator('.drawer-console').innerText()).includes(original)); await closeText(target); }
    await target.getByRole('tab', { name: '用户 Skill · 4', exact: true }).click(); await target.getByRole('button', { name: '查看 Skill：Teams 协作', exact: true }).click(); assert.ok((await target.locator('.drawer-console').innerText()).includes('跨项目可用')); await closeText(target); await closePanels(target);
    for (const width of [1440, 390]) { await target.setViewportSize({ width, height: 1000 }); const layout = await target.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth })); assert.ok(layout.scrollWidth <= layout.width, JSON.stringify({ roleName, id, ...layout })); layoutChecks.push({ roleName, id, ...layout }); }
    await target.setViewportSize({ width: 1440, height: 1000 }); await target.locator('.page-scroll').evaluate(element => { element.scrollTop = 0; }); await target.screenshot({ path: `test-results/project-template-${id === projectId ? 'new' : id}-${roleName}.png`, animations: 'disabled' });
  }
  await visit('projects?project=' + projectId + '&tab=content');
  await openPanel('项目资料'); await page.getByRole('button', { name: '关联项目资产', exact: true }).click();
  await page.getByRole('combobox', { name: '筛选资产来源', exact: true }).click(); await page.locator('.ant-select-item-option-content').getByText('需求平台', { exact: true }).click();
  await page.getByRole('combobox', { name: '选择来源资产', exact: true }).click(); await page.locator('.ant-select-item-option-content').getByText('信用卡消费返现 · 需求平台 · 信用卡营销交付', { exact: true }).click();
  await save('asset.link', '关联所选资产');
  await page.getByRole('button', { name: '查看来源：信用卡消费返现', exact: true }).click();
  assert.ok((await page.locator('.drawer-console').innerText()).includes('来源插件')); await closeText();
  await page.reload(); await openPanel('项目资料'); await page.getByRole('button', { name: '查看来源：信用卡消费返现', exact: true }).waitFor(); await openPanel('知识成果');
  await page.locator('.project-knowledge').getByText('尚未生成项目知识', { exact: true }).waitFor();
  const beforeIndex = await state();
  const [indexed] = await Promise.all([page.waitForResponse(response => response.url() === talentOrigin + '/api/action'), page.locator('[data-action="knowledge"]').click()]); assert.equal(indexed.status(), 200);
  await page.getByRole('button', { name: '查看项目知识：信用卡消费返现 · 来源索引', exact: true }).waitFor();
  await page.locator('.project-knowledge').getByText('当前成果为已关联资料的来源索引，业务规则仍需抽取与确认。', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '查看项目知识：报名与资格分别判断', exact: true }).count(), 0);
  assert.deepEqual(await state(), beforeIndex, 'new project indexing must not update CardDemo state');
  await page.route('**/api/knowledge/assets?project=' + projectId, route => route.abort());
  await page.getByRole('button', { name: '刷新成果', exact: true }).click(); await page.getByText('无法读取 Talent 项目知识', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '查看项目知识：信用卡消费返现 · 来源索引', exact: true }).count(), 0);
  await page.screenshot({ path: 'test-results/project-knowledge-offline.png', animations: 'disabled' });
  await page.unroute('**/api/knowledge/assets?project=' + projectId);
  await page.locator('.project-knowledge').getByRole('button', { name: /^重\s*试$/ }).click(); await page.getByRole('button', { name: '查看项目知识：信用卡消费返现 · 来源索引', exact: true }).waitFor();
  assert.equal((await request('member', 'asset.link', { projectId, sourceAssetId: 'repository:teams:icode-teams' })).status, 403);
  assert.equal((await request('owner', 'asset.link', { projectId, sourceAssetId: 'not-in-provider' })).status, 409);
  assert.equal((await state()).assigned, false);
  created = await state(); assert.equal(created.workspace.projects.length, 1); assert.equal(created.workspace.projects[0].name, '客户门户新版'); assert.deepEqual(business(created), business(initial)); assert.deepEqual(errors, []);
  await writeFile('test-results/project-create-results.json', JSON.stringify({ passed: true, projectId, roleProtection: true, requiredValidation: true, refreshPersistence: true, cardDemoUnchanged: true, emptyTabs: true, sharedTitles, layoutChecks, providerAssociation: true, actualTalentKnowledge: ['legacy flag ignored', 'same-revision build refresh', 'new project source index', 'no cross-project results', 'offline retry'], pageErrors: errors }, null, 2));
  console.log('PASS: independent project create/edit, list/sidebar, refresh, empty tabs, Owner enforcement, invalid fields, existing projects unchanged');
} catch (error) { await page?.screenshot({ path: 'test-results/project-create-failure.png' }); throw error; }
finally { await browser?.close(); await Promise.all([server, talent].map(process => new Promise(resolve => { process.once('exit', resolve); process.kill('SIGTERM'); }))); await rm(dir, { recursive: true, force: true }); }
