import { TalentTaskIntakeService } from './talent-intake.js';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { root, talentRuntimeDir, origin, talentOrigin, talentPort } from './config.js';
import { bodyJson, headers, readFixtures, staticFile } from './http-shared.js';
import { TalentStore } from './talent-store.js';
import { skillCandidate, agentCandidate } from '../src/talent-artifacts.js';
import { buildMockKnowledge } from './talent-knowledge.js';
import { projectionApplied, talentActions, type TalentAction } from './talent-integration.js';
import { DomainError, transition, type DemoState } from '../src/domain.js';
import { updateWorkspace } from '../src/workspace.js';
import type { BusinessKnowledgeResponse, TalentIntegrationContext, TalentProjectState } from '../src/talent-contract.js';

const store = new TalentStore(); await store.init();
const token = randomBytes(24).toString('hex'), fixtures = await readFixtures();
async function teamsJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(origin + path, { ...init, signal: AbortSignal.timeout(5000) }); }
  catch (error) { throw new DomainError('无法连接 Teams 项目服务：' + (error as Error).message, 502); }
  const value = await response.json();
  if (!response.ok) throw new DomainError('Teams：' + (value.error ?? response.statusText), response.status);
  return value;
}
const context = (projectId: string) => teamsJson<TalentIntegrationContext>('/api/integrations/talent/context?project=' + encodeURIComponent(projectId));
const taskIntake = new TalentTaskIntakeService(store, context, talentOrigin);
function checkOwner(body: Record<string, any>) {
  if (body.role !== 'owner') throw new DomainError('此 Talent 操作由项目 Owner 管理', 403);
}
function buildResult(project: TalentProjectState, ctx: TalentIntegrationContext, action: TalentAction, payload: Record<string, unknown>) {
  const at = new Date().toISOString();
  if (action === 'knowledge') {
    if (!ctx.state.workspace.connections.find(connection => connection.id === 'talent')?.enabled) throw new DomainError('请先启用业务知识（Talent）连接');
    if (!ctx.project.assets.length) throw new DomainError('请先在 Teams 关联项目资产');
    if (project.knowledge.status === 'ready') throw new DomainError('此项目已有知识版本，请使用现有成果');
    const assets = buildMockKnowledge(ctx.project, fixtures);
    if (!assets.length) throw new DomainError('当前关联资料无法生成项目知识，请关联原始设计资料后重试');
    project.knowledge = { status: 'ready', version: 'knowledge-v1', builtAt: at, inputAssetIds: ctx.project.assets.map(asset => asset.sourceAssetId ?? asset.id), assets, graphInput: ctx.project.id === 'carddemo' && ctx.project.assets.some(asset => asset.id === 'code' || asset.kind === 'repository') ? 'existing-local-excerpts' : 'not-provided' };
    return;
  }
  if (ctx.project.id !== 'carddemo') throw new DomainError('此项目尚无已上报的交付轨迹，分析与演进保持空态');
  if (action === 'analysis.run') {
    updateWorkspace(ctx.state, action, 'owner', payload);
    if (project.evolution.status !== 'none') throw new DomainError('已有候选，请保留本次分析依据');
    project.analysis = { status: 'analyzed', scope: payload.scope as 'single' | 'project', findings: payload.scope === 'project' ? ['F-01', 'F-02', 'F-03', 'F-04'] : ['F-01', 'F-02'], at };
    return;
  }
  if (!projectionApplied(ctx.state, action)) transition(ctx.state, action, 'owner');
  if (action === 'candidate') {
    if (project.analysis.status !== 'analyzed' || project.evolution.status !== 'none') throw new DomainError('请先在 Talent 完成轨迹分析');
    project.evolution = { status: 'candidate', candidates: [
      { kind: 'skill', version: '1.1.0', definition: skillCandidate },
      { kind: 'agent', version: 'r2', definition: agentCandidate },
    ], evaluations: [] };
  } else if (action === 'evaluate') {
    if (project.evolution.status !== 'candidate') throw new DomainError('请先在 Talent 生成候选');
    project.evolution.status = 'evaluated';
    project.evolution.evaluations = [{ kind: 'skill', result: '固定 Agent/模型/工具，已记录三组业务规则用例的对照结果；未执行模型实验。' }, { kind: 'agent', result: '固定 Skill/模型/工具，已记录三组完成判定用例的对照结果；未执行模型实验。' }];
  } else {
    if (project.evolution.status !== 'evaluated') throw new DomainError('请先完成两组候选评估');
    project.evolution.status = 'published'; project.evolution.publishedAt = at;
  }
}
async function operate(body: Record<string, any>, action: TalentAction) {
  checkOwner(body);
  return store.exclusive(async () => {
    const ctx = await context(typeof body.projectId === 'string' ? body.projectId : 'carddemo');
    if (body.revision !== ctx.state.revision) throw new DomainError('Teams 项目已更新，请刷新后重试');
    const project = store.project(ctx.project), payload = body.payload ?? {};
    const retry = project.projection.status === 'pending' && project.projection.action === action;
    if (project.projection.status === 'pending' && !retry) throw new DomainError('请先重试回传上一项 Talent 成果');
    if (retry && action === 'analysis.run' && payload.scope !== project.analysis.scope) throw new DomainError('重试回传必须保留原分析范围');
    if (!retry) buildResult(project, ctx, action, payload);
    if (ctx.project.id !== 'carddemo') { project.projection = { status: 'not-required' }; await store.save(project); return ctx.state; }
    project.projection = { status: 'pending', action }; await store.save(project);
    try {
      const state = await teamsJson<DemoState>('/api/integrations/talent/results', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Origin': talentOrigin, 'X-Demo-Token': ctx.token }, body: JSON.stringify({ role: 'owner', revision: ctx.state.revision, projectId: ctx.project.id, generation: ctx.project.generation, action, payload }) });
      project.projection = { status: 'confirmed', action }; await store.save(project); return state;
    } catch (error) {
      project.projection = { status: 'pending', action, error: (error as Error).message }; await store.save(project);
      throw new DomainError('Talent 成果已保存，但回传 Teams 失败；刷新后重试同一操作。' + (error as Error).message, 502);
    }
  });
}

const server = createServer(async (request, response) => {
  headers(request, response);
  const json = (code: number, value: unknown) => { response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
  try {
    if (request.headers.host !== '127.0.0.1:' + talentPort) throw new DomainError('请使用本机 127.0.0.1 地址', 403);
    const url = new URL(request.url ?? '/', talentOrigin), path = url.pathname;
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
    if (request.method === 'GET' && path === '/api/health') { json(200, { app: 'talent-carddemo', service: 'talent', workspaceRoot: root, stateRoot: talentRuntimeDir, version: '0.2.0', pid: process.pid, origin: talentOrigin, teamsOrigin: origin }); return; }
    if (request.method === 'GET' && path === '/api/session') { json(200, { token }); return; }
    if (request.method === 'GET' && path === '/api/task-inputs') { json(200, await taskIntake.inputs(url.searchParams.get('projectId') ?? '', url.searchParams.get('taskId') ?? '')); return; }
    if (request.method === 'GET' && path === '/teams') { response.writeHead(302, { Location: origin + '/teams' + url.search }); response.end(); return; }
    if (request.method === 'GET' && ['/api/bootstrap', '/api/state', '/api/knowledge/assets'].includes(path)) {
      const ctx = await context(url.searchParams.get('project') ?? 'carddemo');
      if (path === '/api/state') { json(200, ctx.state); return; }
      if (path === '/api/bootstrap') {
        json(200, { token, state: ctx.state, data: { ...fixtures, talent: { revision: store.state.revision, project: store.project(ctx.project), context: ctx.project } } }); return;
      }
      const selected = url.searchParams.has('project') ? [ctx.project] : ctx.projects;
      const projects = selected.map(project => store.project(project));
      const knowledgePending = (project: TalentProjectState) => project.projection.status === 'pending' && project.projection.action === 'knowledge';
      const data: BusinessKnowledgeResponse = { origin: talentOrigin, assets: projects.filter(project => project.knowledge.status === 'ready' && !knowledgePending(project)).flatMap(project => project.knowledge.assets), projects: projects.map(project => ({ id: project.id, name: project.name, status: knowledgePending(project) ? 'not-built' : project.knowledge.status })) };
      json(200, data); return;
    }
    if (request.method === 'POST' && path.startsWith('/api/')) {
      if (![origin, talentOrigin].includes(request.headers.origin ?? '') || request.headers['x-demo-token'] !== token || !request.headers['content-type']?.startsWith('application/json')) throw new DomainError('请求来源或访问令牌不匹配，请重新打开页面', 403);
      const body = await bodyJson(request, path === '/api/task-sessions' ? 16 * 1024 * 1024 : 65536);
      if (path === '/api/task-inputs/register') { checkOwner(body); json(200, await taskIntake.register(body.projectId, body.taskId)); return; }
      if (path === '/api/task-sessions') { json(200, await taskIntake.receive(body)); return; }
      if (path === '/api/action' && talentActions.includes(body.action)) { json(200, await operate(body, body.action)); return; }
      if (path === '/api/workspace' && body.kind === 'analysis.run' && body.payload && typeof body.payload === 'object') { json(200, await operate(body, 'analysis.run')); return; }
      throw new DomainError('此操作不属于 Talent 服务', 404);
    }
    if (request.method === 'GET' && await staticFile(path, 'talent', response)) return;
    throw new DomainError('Talent 页面或接口不存在', 404);
  } catch (error) { json(error instanceof DomainError ? error.status : 500, { error: (error as Error).message }); }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(talentPort, '127.0.0.1', () => console.log('Talent: ' + talentOrigin + '/talent'));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close(() => process.exit(0)));
