import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { initialState, transition } from '../src/domain.js';

const dir = await mkdtemp(join(tmpdir(), 'owner-overview-')), origin = 'http://127.0.0.1:45975';
let seeded = initialState();
for (const [action, role] of [['knowledge', 'owner'], ['assign', 'owner'], ['prepare', 'member'], ['replay', 'member'], ['check-fail', 'member']] as const) seeded = transition(seeded, action, role);
await writeFile(join(dir, 'state.json'), JSON.stringify(seeded));
const env = { ...process.env, DEMO_PORT: '45975', DEMO_TALENT_PORT: '45985', DEMO_STATE_DIR: dir, DEMO_TALENT_STATE_DIR: join(dir, 'talent'), DEMO_NATIVE_DISABLED: '1' };
const processes = ['server/index.ts', 'server/talent.ts'].map(file => spawn(process.execPath, ['--import', 'tsx', file], { env, stdio: ['ignore', 'pipe', 'pipe'] }));
let logs = ''; for (const process of processes) { process.stdout.on('data', value => logs += value); process.stderr.on('data', value => logs += value); }
let browser;
try {
  let ready = false; for (let attempt = 0; attempt < 100; attempt++) { try { if ((await fetch(origin + '/api/health')).ok && (await fetch('http://127.0.0.1:45985/api/health')).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 100)); } assert.ok(ready, logs);
  const { token } = await (await fetch(origin + '/api/bootstrap')).json() as any;
  const state = async () => await (await fetch(origin + '/api/state')).json() as any;
  const post = async (path: string, body: Record<string, unknown>) => { const response = await fetch(origin + path, { method: 'POST', headers: { origin, 'content-type': 'application/json', 'x-demo-token': token }, body: JSON.stringify({ revision: (await state()).revision, role: 'owner', ...body }) }); assert.equal(response.status, 200, await response.clone().text()); return response.json(); };
  browser = await chromium.launch({ channel: 'chrome', headless: true }); const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); page.setDefaultTimeout(8000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const visit = async (project: string) => { await page.goto(origin + '/teams#/projects?project=' + project + '&tab=content'); await page.locator('.project-owner-overview').waitFor(); };
  const metrics = async () => await page.locator('[data-metric]').evaluateAll(elements => Object.fromEntries(elements.map(element => [element.getAttribute('data-metric'), Number(element.querySelector('strong')?.textContent)])));
  await visit('carddemo'); assert.deepEqual(await metrics(), { all: 1, active: 1, acceptance: 0, delivered: 0, open: 1, blocking: 1 });
  assert.equal(await page.getByRole('button', { name: '关联项目资产', exact: true }).count(), 0, 'asset table starts in secondary project materials');
  for (const [filter, count] of Object.entries(await metrics())) { await page.locator('[data-metric="' + filter + '"]').click(); assert.equal(await page.locator(filter === 'open' || filter === 'blocking' ? '.overview-issues .ant-table-row' : '.overview-requirements .ant-table-row').count(), count); }
  await page.screenshot({ path: 'test-results/owner-overview-blocking.png', animations: 'disabled' });
  await page.getByRole('button', { name: '需协调阻塞：未报名时应提供餐饮活动报名入口', exact: true }).click(); await page.getByText('阻塞当前交付', { exact: true }).waitFor();
  await page.getByRole('button', { name: '关联需求：餐饮消费返现', exact: true }).click(); await page.getByRole('button', { name: '进入交付节点', exact: true }).click();
  await page.getByRole('button', { name: '节点：验证', exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: '节点：验证', exact: true }).getAttribute('aria-current'), 'step');
  await post('/api/action', { action: 'fix', role: 'member' }); await visit('carddemo'); assert.equal((await metrics()).blocking, 0); assert.equal((await metrics()).open, 0);
  await post('/api/action', { action: 'submit', role: 'member' }); await visit('carddemo'); assert.equal((await metrics()).acceptance, 1);
  await page.getByRole('button', { name: '待验收成果：餐饮消费返现', exact: true }).click(); await page.getByRole('button', { name: '节点：验收', exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: '节点：验收', exact: true }).getAttribute('aria-current'), 'step');
  await visit('teams'); assert.deepEqual(await metrics(), { all: 4, active: 1, acceptance: 1, delivered: 2, open: 0, blocking: 0 });
  assert.equal(await page.locator('.overview-requirements .ant-table-row').count(), 4); await page.getByRole('button', { name: /T108 · 调研外部需求系统接入范围/ }).waitFor();
  await page.getByRole('button', { name: '待验收成果：项目规范与 Skill 可见性', exact: true }).click(); assert.ok(page.url().includes('task=T106')); assert.ok(page.url().includes('node=accept'));
  await visit('teams'); await page.getByRole('button', { name: '待确认讨论标准：团队配置的适用范围', exact: true }).click(); await page.getByRole('heading', { name: 'R19 · 团队配置的适用范围', exact: true }).waitFor();
  await visit('teams'); await page.getByRole('button', { name: '项目资料', exact: true }).click(); await page.getByRole('button', { name: '查看 AGENTS.md', exact: true }).click(); await page.locator('.drawer-console').getByText('项目导览', { exact: false }).waitFor();
  await page.locator('.ant-drawer').filter({ has: page.locator('.drawer-console') }).locator('.ant-drawer-close').click(); await page.locator('.drawer-console').waitFor({ state: 'hidden' }); await page.locator('.owner-project-panel .ant-drawer-close').click(); await page.locator('.owner-project-panel').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '知识成果', exact: true }).click(); await page.locator('.project-knowledge').getByText('尚未生成项目知识', { exact: true }).waitFor(); await page.locator('.project-knowledge-drawer .ant-drawer-close').click(); await page.locator('.project-knowledge-drawer').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '查看 Skill', exact: true }).click(); await page.getByRole('tab', { name: '项目 Skill · 3', exact: true }).waitFor(); await page.getByRole('tab', { name: '用户 Skill · 4', exact: true }).click(); await page.getByRole('button', { name: '查看 Skill：Teams 协作', exact: true }).waitFor(); await page.locator('.owner-project-panel .ant-drawer-close').click(); await page.locator('.owner-project-panel').waitFor({ state: 'hidden' });
  const id = randomUUID(); await post('/api/workspace', { kind: 'project.create', payload: { id, name: '概览空项目', description: '', remoteUrl: 'mock://project', repositoryIdentity: 'project' } }); await visit(id);
  assert.ok(Object.values(await metrics()).every(value => value === 0)); await page.getByRole('button', { name: '关联项目数据', exact: true }).click(); await page.getByRole('button', { name: '关联项目资产', exact: true }).waitFor();
  await post('/api/workspace', { kind: 'asset.link', payload: { projectId: id, sourceAssetId: 'requirements:teams:REQ-T105' } }); await visit(id); assert.equal((await metrics()).all, 1); assert.equal((await metrics()).delivered, 0);
  await page.getByRole('button', { name: '待确认需求：团队项目入口与项目切换', exact: true }).click(); await page.getByText('此条目已关联到项目，尚未建立本项目的交付任务。', { exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: '进入交付节点', exact: true }).count(), 0);
  const layouts: unknown[] = [];
  for (const theme of ['light', 'dark']) for (const project of ['carddemo', 'teams', id]) for (const width of [1920, 1440, 768, 390]) {
    await page.evaluate(theme => localStorage.setItem('carddemo-theme', theme), theme); await page.setViewportSize({ width, height: 1000 }); await visit(project); const measured = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, gutter: document.querySelector('.overview-header')!.getBoundingClientRect().left - document.querySelector('.framework-sidebar')!.getBoundingClientRect().right })); assert.ok(measured.scrollWidth <= width); assert.equal(measured.gutter, width > 760 ? 24 : 16); layouts.push({ project, theme, ...measured });
    if (width === 1440 || width === 390) { await page.waitForTimeout(100); await page.screenshot({ path: `test-results/owner-overview-${project === id ? 'new' : project}-${theme}-${width}.png`, animations: 'disabled' }); }
  }
  await page.setViewportSize({ width: 1440, height: 1000 }); await visit('carddemo'); await page.getByRole('combobox', { name: '切换演示角色' }).click(); await page.locator('.ant-select-item-option-content').getByText('陈晨 · 项目成员', { exact: true }).click(); await page.locator('.project-content-template').waitFor(); assert.equal(await page.locator('.project-owner-overview').count(), 0); assert.equal(await page.locator('[data-action="accept"]').count(), 0); await page.getByRole('heading', { name: '项目资料与资产', exact: true }).waitFor();
  assert.deepEqual(errors, []); await writeFile('test-results/owner-overview-results.json', JSON.stringify({ passed: true, metricsAndFilters: true, ownerTodoRoutes: true, sourceAndTaskIdentity: true, newProjectIsolation: true, membersRetained: true, layouts, pageErrors: errors }, null, 2)); console.log('PASS: Owner project overview metrics, filters, real stages, todo routes, materials, knowledge/Skills, scope isolation, 24 layouts');
} finally { await browser?.close(); await Promise.all(processes.map(process => new Promise(resolve => { process.once('exit', resolve); process.kill('SIGTERM'); }))); await rm(dir, { recursive: true, force: true }); }
