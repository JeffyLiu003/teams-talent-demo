import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { root, runtimeDir, port, origin, talentOrigin } from './config.js';
import { Store } from './store.js';
import { DomainError, type Action, type Role } from '../src/domain.js';
import { toolsStatus, verifySession, writeContext, foundationSkill, launch, focusActive } from './native.js';
import { createSourcePluginCatalog } from '../src/source-plugins.js';
import type { WorkspaceAction } from '../src/workspace.js';
import { headers, bodyJson, staticFile, readFixtures } from './http-shared.js';
import { talentActions, talentContexts, selectTalentContext, projectionApplied, type TalentAction } from './talent-integration.js';
import { ProjectWorkService } from './project-work.js';
import { collaborationContext, collaborationOperation, collaborationWrite } from './collaboration-service.js';
const store = new Store(); await store.init();
const token = randomBytes(24).toString('hex');
const fixtures = await readFixtures();
const work = new ProjectWorkService(() => store.state, fixtures);
const sourceCatalog = createSourcePluginCatalog(fixtures);
const server = createServer(async (request, response) => {
  headers(request, response);
  const json = (code: number, value: unknown) => { response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
  try {
    if (request.headers.host !== '127.0.0.1:' + port) { json(403, { error: '请使用本机 127.0.0.1 地址' }); return; }
    const url = new URL(request.url ?? '/', origin), path = url.pathname;
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
    if (request.method === 'GET' && path === '/talent') { response.writeHead(302, { Location: talentOrigin + '/talent' + url.search }); response.end(); return; }
    if (request.method === 'GET' && path === '/api/session') { json(200, { token }); return; }
    if (request.method === 'GET' && path === '/api/integrations/talent/context') {
      const projects = talentContexts(store.state, sourceCatalog, fixtures.teamsProject.project.name);
      json(200, { token, state: store.state, projects, project: selectTalentContext(projects, url.searchParams.get('project') ?? 'carddemo') }); return;
    }
    if (request.method === 'GET' && path === '/api/health') { json(200, { app: 'teams-talent-carddemo', service: 'teams', workspaceRoot: root, stateRoot: runtimeDir, version: '0.2.0', pid: process.pid, origin, talentOrigin }); return; }
    if (request.method === 'GET' && path === '/api/bootstrap') { json(200, { token, state: store.state, data: fixtures }); return; }
    if (request.method === 'GET' && path === '/api/state') { json(200, store.state); return; }
    if (request.method === 'GET' && path === '/api/project-work') {
      const { role, ...target } = Object.fromEntries(url.searchParams);
      if (role !== 'owner' && role !== 'member') throw new DomainError('请选择演示角色', 400);
      json(200, await work.plan(role, target as any)); return;
    }
    if (request.method === 'GET' && path === '/api/collaboration/context') { json(200, await collaborationContext(store.state, fixtures, Object.fromEntries(url.searchParams))); return; }
    if (request.method === 'GET' && path === '/api/collaboration/operation') { json(200, collaborationOperation(store.state, url.searchParams.get('operationId') ?? '')); return; }
    if (request.method === 'GET' && path === '/api/tools') { json(200, await toolsStatus()); return; }
    if (request.method === 'POST' && path.startsWith('/api/')) {
      if (!([origin, talentOrigin].includes(request.headers.origin ?? '')) || request.headers['x-demo-token'] !== token || !request.headers['content-type']?.startsWith('application/json')) {
        json(403, { error: '请求来源或演示令牌不匹配，请重新打开页面' }); return;
      }
      const body = await bodyJson(request);
      if (!body || !['owner', 'member'].includes(body.role)) throw new DomainError('请选择演示角色', 400);
      if (path === '/api/integrations/talent/results') {
        if (request.headers.origin !== talentOrigin || body.role !== 'owner' || body.projectId !== 'carddemo' || ![...talentActions, 'analysis.run'].includes(body.action)) throw new DomainError('Talent 结果投影请求无效', 403);
        if (body.generation !== (store.state.talentGeneration ?? 'initial')) throw new DomainError('Teams 演示已重置，请重新构建 Talent 成果');
        const action = body.action as TalentAction, payload = body.payload ?? {};
        if (projectionApplied(store.state, action, payload)) { json(200, store.state); return; }
        json(200, action === 'analysis.run' ? await store.update(body.revision, action, 'owner', payload) : await store.apply(body.revision, action, 'owner', {})); return;
      }
      if (path === '/api/action' && talentActions.includes(body.action)) throw new DomainError('此操作由独立 Talent 服务处理', 400);
      if (path === '/api/action') { json(200, await store.apply(body.revision, body.action as Action, body.role as Role, { reason: body.reason })); return; }
      if(path==='/api/workspace'){
        if (body.kind === 'analysis.run') throw new DomainError('轨迹分析由独立 Talent 服务处理', 400);
        if (body.kind === 'connection.update' && body.payload?.id === 'business-knowledge') body.payload.id = 'talent';
        if(!body.payload || typeof body.payload!=='object' || Array.isArray(body.payload))throw new DomainError('工作区请求格式无效',400);
        json(200,await store.update(body.revision,body.kind as WorkspaceAction,body.role as Role,body.payload,sourceCatalog.list()));return;
      }
      if (path === '/api/reset') {
        if (body.role !== 'owner') throw new DomainError('仅 Owner 可以重置演示', 403);
        json(200, await store.reset(body.revision)); return;
      }
      if (path === '/api/collaboration') { json(200, await collaborationWrite(store, fixtures, body)); return; }
      if (path === '/api/native/work-bind') { json(200, await work.bind(body.role, body.target, body.directory)); return; }
      if (path === '/api/native/work-start') { json(200, await work.start(body.role, { requestId: body.requestId, target: body.target, action: body.action, planToken: body.planToken })); return; }
      if (path === '/api/native/verify') { json(200, await verifySession()); return; }
      if (path === '/api/native/context') { json(200, await writeContext(store.state)); return; }
      if(path==='/api/native/foundation'){json(200,await foundationSkill());return;}
      if (path === '/api/native/focus') {
        if (process.env.DEMO_NATIVE_DISABLED === '1') throw new DomainError('此验证实例未开放本机启动', 403);
        json(200, await focusActive()); return;
      }
      if (path === '/api/native/launch') {
        if (process.env.DEMO_NATIVE_DISABLED === '1') throw new DomainError('此验证实例未开放本机启动', 403);
        if (!['icode', 'opencode'].includes(body.tool) || typeof body.restore !== 'boolean' || typeof body.requestId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(body.requestId)) throw new DomainError('启动请求无效', 400);
        json(200, await launch(body.tool, body.restore, body.requestId)); return;
      }
      throw new DomainError('接口不存在', 404);
    }
    if (request.method === 'GET' && await staticFile(path, 'teams', response)) return;
    json(404, { error: '页面不存在' });
  } catch (error) {
    const status = error instanceof DomainError ? error.status : 500;
    json(status, { error: error instanceof Error ? error.message : '请求失败' });
  }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', async () => {
  await mkdir(runtimeDir, { recursive: true });
  console.log('Teams Demo: ' + origin + '/teams');
  console.log('Talent 独立入口: ' + talentOrigin + '/talent');
});
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => { server.close(() => process.exit(0)); });
