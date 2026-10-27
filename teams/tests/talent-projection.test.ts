import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initialState, transition } from '../src/domain.js';

test('Talent preserves pending artifacts and retries the narrow Teams projection without rebuilding', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'talent-projection-'));
  const origin = 'http://127.0.0.1:45987';
  let state = initialState(), failProjection = true, writes = 0;
  const project = { id: 'carddemo', name: state.workspace.project.name, assets: state.workspace.project.assets, generation: 'initial', requirementId: 'DEMO-MKT-001' };
  const teams = createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.url?.startsWith('/api/integrations/talent/context')) { response.end(JSON.stringify({ token: 'fixture-token', state, project, projects: [project] })); return; }
    if (request.method === 'POST' && request.url === '/api/integrations/talent/results') {
      assert.equal(request.headers.origin, origin); assert.equal(request.headers['x-demo-token'], 'fixture-token');
      const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString()); assert.equal(body.projectId, 'carddemo'); assert.equal(body.action, 'knowledge');
      if (failProjection) { response.writeHead(503); response.end(JSON.stringify({ error: '测试中的 Teams 写入不可用' })); return; }
      state = transition(state, 'knowledge', 'owner'); writes++; response.end(JSON.stringify(state)); return;
    }
    response.writeHead(404); response.end(JSON.stringify({ error: 'unsupported test route' }));
  });
  await new Promise<void>((resolve, reject) => { teams.once('error', reject); teams.listen(45977, '127.0.0.1', resolve); });
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/talent.ts'], { env: { ...process.env, DEMO_PORT: '45977', DEMO_TALENT_PORT: '45987', DEMO_STATE_DIR: join(dir, 'teams'), DEMO_TALENT_STATE_DIR: join(dir, 'talent'), DEMO_NATIVE_DISABLED: '1' }, stdio: 'pipe' });
  let logs = ''; child.stdout.on('data', chunk => logs += chunk); child.stderr.on('data', chunk => logs += chunk);
  try {
    let ready = false;
    for (let index = 0; index < 60; index++) { try { ready = (await fetch(origin + '/api/health')).ok; if (ready) break; } catch {} await new Promise(resolve => setTimeout(resolve, 50)); }
    assert.ok(ready, logs);
    const { token } = await (await fetch(origin + '/api/session')).json();
    const post = async (action: string) => fetch(origin + '/api/action', { method: 'POST', headers: { origin, 'content-type': 'application/json', 'x-demo-token': token }, body: JSON.stringify({ role: 'owner', projectId: 'carddemo', revision: state.revision, action }) });
    let response = await post('knowledge'); assert.equal(response.status, 502); assert.match((await response.json()).error, /成果已保存.*回传 Teams 失败/);
    const pending = JSON.parse(await readFile(join(dir, 'talent/talent-state.json'), 'utf8')).projects.carddemo;
    assert.equal(pending.projection.status, 'pending'); assert.equal(pending.knowledge.assets.length, 4); assert.equal(writes, 0);
    assert.deepEqual((await (await fetch(origin + '/api/knowledge/assets')).json()).assets, []);
    response = await post('candidate'); assert.equal(response.status, 409); assert.match((await response.json()).error, /先重试回传/);
    failProjection = false;
    response = await post('knowledge'); assert.equal(response.status, 200); assert.equal((await response.json()).knowledge, true);
    const confirmed = JSON.parse(await readFile(join(dir, 'talent/talent-state.json'), 'utf8')).projects.carddemo;
    assert.equal(confirmed.projection.status, 'confirmed'); assert.deepEqual(confirmed.knowledge, pending.knowledge); assert.equal(writes, 1);
    assert.equal((await (await fetch(origin + '/api/knowledge/assets')).json()).assets.length, 4);
    await assert.rejects(stat(join(dir, 'teams/state.json')), { code: 'ENOENT' });
  } finally {
    child.kill('SIGTERM'); await new Promise<void>(resolve => child.once('exit', () => resolve()));
    await new Promise<void>((resolve, reject) => teams.close(error => error ? reject(error) : resolve())); await rm(dir, { recursive: true, force: true });
  }
});
