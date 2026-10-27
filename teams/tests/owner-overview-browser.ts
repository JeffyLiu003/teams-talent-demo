import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { initialState } from '../src/domain.js';
import { sharedPaths, type TalentsKnowledge } from '../../shared/contracts.js';

const dir = await mkdtemp(join(tmpdir(), 'owner-overview-')), origin = 'http://127.0.0.1:45975', shared = join(dir, 'shared');
await writeFile(join(dir, 'state.json'), JSON.stringify(initialState()));
// Stands in for Talents: CardDemo knowledge is already published in the shared data directory, so Teams marks project knowledge built on first read.
await mkdir(join(shared, 'talents', 'files', 'a-biz', 'v1', 'doc-knowledge'), { recursive: true });
await writeFile(join(shared, sharedPaths.talentsFile('a-biz', 1, 'doc-knowledge/业务规则目录.md')), '# 业务规则目录');
await writeFile(join(shared, sharedPaths.talentsKnowledge), JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), artifacts: [{ id: 'a-biz', projectId: 'carddemo', name: '信用卡营销返现业务知识', description: '白金卡返现规则', capability: 'doc-extract', capabilityName: '业务知识提取', category: 'doc', kind: 'files', version: 1, publishedAt: '2026-10-27T10:00:00.000Z', note: '', delivery: 'local', files: [{ path: 'doc-knowledge/业务规则目录.md', title: '业务规则目录', type: 'markdown' }] }] } satisfies TalentsKnowledge));
const env = { ...process.env, DEMO_PORT: '45975', DEMO_TALENT_PORT: '45985', DEMO_STATE_DIR: dir, DEMO_SHARED_DIR: shared, DEMO_SHARED_SEED_DIR: join(dir, 'no-seed'), DEMO_NATIVE_DISABLED: '1' };
const processes = ['server/index.ts'].map(file => spawn(process.execPath, ['--import', 'tsx', file], { env, stdio: ['ignore', 'pipe', 'pipe'] }));
let logs = ''; for (const process of processes) { process.stdout.on('data', value => logs += value); process.stderr.on('data', value => logs += value); }
let browser;
try {
  let ready = false; for (let attempt = 0; attempt < 100; attempt++) { try { if ((await fetch(origin + '/api/health')).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 100)); } assert.ok(ready, logs);
  const { token } = await (await fetch(origin + '/api/bootstrap')).json() as any;
  const state = async () => await (await fetch(origin + '/api/state')).json() as any;
  assert.equal((await state()).knowledgeVersion, '信用卡营销返现业务知识 v1', 'knowledge published by Talents is synced before the delivery flow');
  const post = async (path: string, body: Record<string, unknown>) => { const response = await fetch(origin + path, { method: 'POST', headers: { origin, 'content-type': 'application/json', 'x-demo-token': token }, body: JSON.stringify({ revision: (await state()).revision, role: 'owner', ...body }) }); assert.equal(response.status, 200, await response.clone().text()); return response.json(); };
  browser = await chromium.launch({ channel: 'chrome', headless: true }); const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); page.setDefaultTimeout(8000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const visit = async (project: string) => { await page.goto('about:blank'); await page.goto(origin + '/teams#/projects?project=' + project + '&tab=content'); await page.locator('.project-owner-overview').waitFor(); };
  const metrics = async () => await page.locator('[data-metric]').evaluateAll(elements => Object.fromEntries(elements.map(element => [element.getAttribute('data-metric'), Number(element.querySelector('strong')?.textContent)])));
  await visit('carddemo'); await page.locator('[data-knowledge-summary="carddemo"]').getByText('已发布 1 项', { exact: true }).waitFor(); assert.deepEqual(await metrics(), { all: 5, pending: 1, active: 2, acceptance: 1, delivered: 1, issues: 7, open: 4, closed: 1, unconfirmed: 2, blocking: 2 });
  assert.equal(await page.getByRole('button', { name: '关联项目资产', exact: true }).count(), 0, 'asset table starts in secondary project materials');
  assert.equal(await page.locator('[data-overview-group="requirements"] [data-metric]').count(), 5); assert.equal(await page.locator('[data-overview-group="issues"] [data-metric]').count(), 5);
  const expectedFilters: Record<string, string[]> = {
    all: ['DEMO-MKT-001', 'MKT-002', 'MKT-003', 'MKT-004', 'MKT-005'], pending: ['DEMO-MKT-001'], active: ['MKT-002', 'MKT-003'], acceptance: ['MKT-004'], delivered: ['MKT-005'],
    issues: ['CARD-BUG-001', 'CARD-BUG-002', 'CARD-BUG-003', 'CARD-BUG-004', 'CARD-BUG-005', 'CARD-BUG-006', 'CARD-BUG-007'], open: ['CARD-BUG-003', 'CARD-BUG-004', 'CARD-BUG-005', 'CARD-BUG-006'], closed: ['CARD-BUG-007'], unconfirmed: ['CARD-BUG-001', 'CARD-BUG-002'], blocking: ['CARD-BUG-003', 'CARD-BUG-004'],
  };
  for (const [filter, ids] of Object.entries(expectedFilters)) {
    const issues = ['issues', 'open', 'closed', 'unconfirmed', 'blocking'].includes(filter);
    await page.locator('[data-metric="' + filter + '"]').click();
    const rows = page.locator(issues ? '.overview-issues .ant-table-row' : '.overview-requirements .ant-table-row');
    assert.deepEqual(await rows.evaluateAll(elements => elements.map(element => element.getAttribute('data-row-key')!.split(':').at(-1))), ids);
    const summary = page.locator('[data-overview-list-summary]'); assert.equal(await summary.getAttribute('data-list-count'), String(ids.length)); assert.equal(await summary.getAttribute('data-list-total'), issues ? '7' : '5');
    assert.equal(await page.getByRole('tab', { name: issues ? '问题 · 7' : '需求 · 5', exact: true }).getAttribute('aria-selected'), 'true');
  }
  await page.getByRole('tab', { name: '需求 · 5', exact: true }).click(); assert.equal(await page.locator('.overview-requirements .ant-table-row').count(), 5);
  await page.getByRole('tab', { name: '问题 · 7', exact: true }).click(); assert.equal(await page.locator('.overview-issues .ant-table-row').count(), 7);
  await page.locator('[data-metric="blocking"]').click(); await page.getByRole('button', { name: '清除筛选', exact: true }).click(); assert.equal(await page.locator('.overview-issues .ant-table-row').count(), 7);
  await page.getByRole('button', { name: '需协调阻塞：返现明细翻页出现重复记录', exact: true }).click(); const detail = page.locator('.ant-drawer:visible').last();
  await detail.getByText('阻塞当前交付', { exact: true }).waitFor(); await detail.getByRole('button', { name: '关联需求：返现明细查询', exact: true }).click();
  assert.equal(await detail.getByRole('button', { name: '进入交付节点', exact: true }).count(), 0); await detail.getByText('来源插件 · MKT-002', { exact: true }).waitFor();
  await detail.getByRole('button', { name: '查看来源原文', exact: true }).click(); await page.locator('.drawer-console').getByText('需求来源：需求平台', { exact: false }).waitFor(); assert.ok(!(await page.locator('.drawer-console').innerText()).includes('E3'));
  await page.locator('.ant-drawer').filter({ has: page.locator('.drawer-console') }).locator('.ant-drawer-close').click(); await page.locator('.drawer-console').waitFor({ state: 'hidden' }); await page.locator('.ant-drawer-close:visible').last().click(); await page.getByText('来源插件 · MKT-002', { exact: true }).waitFor({ state: 'hidden' });
  for (const [action, role] of [['assign', 'owner'], ['prepare', 'member'], ['replay', 'member'], ['check-fail', 'member']] as const) await post('/api/action', { action, role });
  await visit('carddemo'); assert.deepEqual(await metrics(), { all: 5, pending: 0, active: 3, acceptance: 1, delivered: 1, issues: 7, open: 5, closed: 1, unconfirmed: 1, blocking: 3 });
  await page.screenshot({ path: 'test-results/owner-overview-blocking.png', animations: 'disabled' });
  await page.getByRole('button', { name: '需协调阻塞：普通卡不应进入白金卡返现范围', exact: true }).click(); await page.getByText('阻塞当前交付', { exact: true }).waitFor();
  await page.getByRole('button', { name: '关联需求：信用卡消费返现', exact: true }).click(); await page.getByRole('button', { name: '进入交付节点', exact: true }).click();
  await page.getByRole('button', { name: '节点：验证', exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: '节点：验证', exact: true }).getAttribute('aria-current'), 'step');
  await post('/api/action', { action: 'fix', role: 'member' }); await visit('carddemo'); assert.equal((await metrics()).blocking, 2); assert.equal((await metrics()).open, 4); assert.equal((await metrics()).closed, 2);
  await post('/api/action', { action: 'submit', role: 'member' }); await visit('carddemo'); assert.equal((await metrics()).acceptance, 2);
  await page.getByRole('button', { name: '待验收成果：信用卡消费返现', exact: true }).click(); await page.getByRole('button', { name: '节点：验收', exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: '节点：验收', exact: true }).getAttribute('aria-current'), 'step');
  await visit('teams'); assert.deepEqual(await metrics(), { all: 4, pending: 0, active: 1, acceptance: 1, delivered: 2, issues: 1, open: 0, closed: 0, unconfirmed: 1, blocking: 0 });
  assert.equal(await page.locator('.overview-requirements .ant-table-row').count(), 4); await page.getByRole('button', { name: /T108 · 调研外部需求系统接入范围/ }).waitFor();
  await page.getByRole('button', { name: '待验收成果：项目规范与 Skill 可见性', exact: true }).click(); assert.ok(page.url().includes('task=T106')); assert.ok(page.url().includes('node=accept'));
  await visit('teams'); await page.getByRole('button', { name: '待确认讨论标准：团队配置的适用范围', exact: true }).click(); await page.getByRole('heading', { name: 'R19 · 团队配置的适用范围', exact: true }).waitFor();
  await visit('teams'); await page.getByRole('button', { name: '项目资料', exact: true }).click(); await page.getByRole('button', { name: '查看 AGENTS.md', exact: true }).click(); await page.locator('.drawer-console').getByText('项目导览', { exact: false }).waitFor();
  await page.locator('.ant-drawer').filter({ has: page.locator('.drawer-console') }).locator('.ant-drawer-close').click(); await page.locator('.drawer-console').waitFor({ state: 'hidden' }); await page.locator('.owner-project-panel .ant-drawer-close').click(); await page.locator('.owner-project-panel').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '查看知识', exact: true }).click(); await page.locator('.project-knowledge').getByText('Talents 尚未为此项目发布知识', { exact: true }).waitFor(); assert.equal(await page.locator('[data-artifact]').count(), 0, 'CardDemo knowledge is not shown in the Teams project'); await page.locator('.project-knowledge-drawer .ant-drawer-close').click(); await page.locator('.project-knowledge-drawer').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '查看 Skill', exact: true }).click(); await page.getByRole('tab', { name: '项目 Skill · 3', exact: true }).waitFor(); await page.getByRole('tab', { name: '用户 Skill · 4', exact: true }).click(); await page.getByRole('button', { name: '查看 Skill：Teams 协作', exact: true }).waitFor(); await page.locator('.owner-project-panel .ant-drawer-close').click(); await page.locator('.owner-project-panel').waitFor({ state: 'hidden' });
  const id = randomUUID(); await post('/api/workspace', { kind: 'project.create', payload: { id, name: '概览空项目', description: '', remoteUrl: 'mock://project', repositoryIdentity: 'project' } }); await visit(id);
  assert.ok(Object.values(await metrics()).every(value => value === 0)); await page.getByRole('button', { name: '关联项目数据', exact: true }).click(); await page.getByRole('button', { name: '关联项目资产', exact: true }).waitFor();
  await post('/api/workspace', { kind: 'asset.link', payload: { projectId: id, sourceAssetId: 'requirements:teams:REQ-T105' } }); await visit(id); assert.equal((await metrics()).all, 1); assert.equal((await metrics()).delivered, 0);
  await page.getByRole('button', { name: '待确认需求：团队项目入口与项目切换', exact: true }).click(); await page.getByText('此条目保留来源交付记录，尚无可进入的 Teams 交付任务。', { exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: '进入交付节点', exact: true }).count(), 0);
  const layouts: unknown[] = [];
  for (const theme of ['light', 'dark']) for (const project of ['carddemo', 'teams', id]) for (const width of [1920, 1440, 768, 390]) {
    await page.evaluate(theme => localStorage.setItem('carddemo-theme', theme), theme); await page.setViewportSize({ width, height: 1000 }); await visit(project); const measured = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, gutter: document.querySelector('.overview-header')!.getBoundingClientRect().left - document.querySelector('.framework-sidebar')!.getBoundingClientRect().right })); assert.ok(measured.scrollWidth <= width); assert.equal(measured.gutter, width > 760 ? 24 : 16); layouts.push({ project, theme, ...measured });
    if (width === 1440 || width === 390) { await page.waitForTimeout(100); await page.screenshot({ path: `test-results/owner-overview-${project === id ? 'new' : project}-${theme}-${width}.png`, animations: 'disabled' }); }
  }
  await page.setViewportSize({ width: 1440, height: 1000 }); await visit('carddemo'); await page.getByRole('combobox', { name: '切换角色' }).click(); await page.locator('.ant-select-item-option-content').getByText('陈晨 · 项目成员', { exact: true }).click(); await page.locator('.project-content-template').waitFor(); assert.equal(await page.locator('.project-owner-overview').count(), 0); assert.equal(await page.locator('[data-action="accept"]').count(), 0); await page.getByRole('heading', { name: '项目资料与资产', exact: true }).waitFor();
  assert.deepEqual(errors, []); await writeFile('test-results/owner-overview-results.json', JSON.stringify({ passed: true, metricsAndFilters: true, ownerTodoRoutes: true, sourceAndTaskIdentity: true, newProjectIsolation: true, membersRetained: true, layouts, pageErrors: errors }, null, 2)); console.log('PASS: Owner project overview metrics, filters, real stages, todo routes, materials, knowledge/Skills, scope isolation, 24 layouts');
} finally { await browser?.close(); await Promise.all(processes.map(process => new Promise(resolve => { process.once('exit', resolve); process.kill('SIGTERM'); }))); await rm(dir, { recursive: true, force: true }); }
