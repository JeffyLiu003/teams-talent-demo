import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initialState } from '../src/domain.js';
import { createDeliveryRequirement } from '../src/delivery-requirements.js';
import type { TaskSessionStreamResponse } from '../src/task-session-stream.js';

const runtime = await mkdtemp(join(tmpdir(), 'session-stream-http-')), origin = 'http://127.0.0.1:46204', state = initialState();
const scope = { projectId: 'carddemo', taskId: 'MKT-STREAM-HTTP', nodeId: 'prepare' };
createDeliveryRequirement(state, 'owner', { ...scope, id: scope.taskId, title: '会话协议验证', description: '隔离文件增长验证，不代表原生执行。', assigneeId: 'member', skillIds: ['dev-code-reviewer'] }, new Date().toISOString());
createDeliveryRequirement(state, 'owner', { ...scope, id: 'MKT-STREAM-OTHER', title: '其他交付人的任务', description: '用于读取权限检查', assigneeId: 'su', skillIds: ['dev-code-reviewer'] }, new Date().toISOString());
await writeFile(join(runtime, 'state.json'), JSON.stringify(state));
const runId = randomUUID(), sessionId = randomUUID(), startedAt = new Date().toISOString();
const runRoot = join(runtime, 'work-contexts', runId + '.native'), sessionRoot = join(runRoot, 'session-root'), directory = join(sessionRoot, 'sessions', sessionId.replaceAll('-', '').slice(0, 12));
await mkdir(join(directory, 'trajectory'), { recursive: true });
await writeFile(join(runRoot, 'manifest.json'), JSON.stringify({ runId, scope }));
await writeFile(join(runRoot, 'native-session.json'), JSON.stringify({ ...scope, runId, sessionId, sessionRoot, pid: process.pid, startedAt, source: 'icode-active-session-owner' }));
await mkdir(join(sessionRoot, 'sessions', '.locks'));
await writeFile(join(sessionRoot, 'sessions', '.locks', sessionId.replaceAll('-', '').slice(0, 12) + '.active.json'), JSON.stringify({ session_id: sessionId, pid: process.pid, started_at: startedAt }));
const document = { meta: { session_id: sessionId }, state: { messages: [{ role: 'user', message_id: 'user-1', contents: [{type:'text',text:'请展示实际用户输入'}], additional_properties:{_chrys_created_at:startedAt,_chrys_analytics_item_id:'user-1'} }] } };
await writeFile(join(directory, 'session.json'), JSON.stringify(document));
const event = (id: string, kind: string, payload: Record<string, unknown>) => JSON.stringify({ event_id: id, event_type: kind, session_id: sessionId, occurred_at: new Date().toISOString(), turn_id: 'turn-1', payload });
const trajectory = join(directory, 'trajectory', 'events.jsonl');
await writeFile(trajectory, event('start', 'turn.started', { turn_number: 1, opening_item_id:'user-1' }) + '\n');
let logs = '';
const server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { env: { ...process.env, DEMO_PORT: '46204', DEMO_TALENT_PORT: '46205', DEMO_STATE_DIR: runtime, DEMO_TALENT_STATE_DIR: join(runtime, 'unused-talent'), DEMO_NATIVE_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', bytes => logs += bytes); server.stderr.on('data', bytes => logs += bytes);
const request = async (params: Record<string, string>, expected = 200) => {
  const response = await fetch(origin + '/api/task-session-stream?' + new URLSearchParams(params)); const value = await response.json();
  assert.equal(response.status, expected, JSON.stringify(value)); assert.equal(response.headers.get('cache-control'), 'no-store'); return value as TaskSessionStreamResponse;
};
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + '/api/health')).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  assert.ok(ready, logs);
  // The Store performs its existing one-time legacy migration at startup. Measure the read-only requests after it.
  const originalState = await readFile(join(runtime, 'state.json'));
  assert.deepEqual(JSON.parse(originalState.toString()).workspace.deliveryRequirements.filter((task: {id:string}) => task.id !== 'DEMO-MKT-001'), state.workspace.deliveryRequirements);
  const query = { ...scope, role: 'member' }, first = await request(query);
  assert.equal(first.turns.length, 1); assert.equal(first.turns[0].user?.text, '请展示实际用户输入'); assert.equal(first.sessions[0].status, 'running');
  assert.equal((await request({ ...query, cursor: first.cursor! })).turns.length, 0);
  document.state.messages.push({role:'assistant',message_id:'reply-1',contents:[{type:'text',text:'真实回复的可见部分'}],additional_properties:{_chrys_created_at:new Date().toISOString(),_chrys_analytics_item_id:'reply-1'}});
  await writeFile(join(directory,'session.json'),JSON.stringify(document));
  const next=await request({...query,cursor:first.cursor!});assert.equal(next.turns.length,1);assert.equal(next.turns[0].id,first.turns[0].id);assert.equal(next.turns[0].replies[0].text,'真实回复的可见部分');
  await appendFile(trajectory,event('tool','tool.operation.started',{tool_name:'read_file'})+'\n');assert.equal((await request({...query,cursor:next.cursor!})).turns.length,0);
  assert.deepEqual((await request({ ...query, taskId: 'MKT-STREAM-OTHER' })).turns, []);
  await request({ ...query, sessionId: randomUUID() }, 404);
  await request({ ...query, nodeId: '../session.json' }, 400);
  await request({ ...query, role: 'guest' }, 400);
  await request({ ...query, role: 'owner', cursor: next.cursor! }, 400);
  await writeFile(join(runRoot, 'result.json'), JSON.stringify({ ...scope, runId, sessionId, status: 'failed', finishedAt: new Date().toISOString() }));
  assert.equal((await request(query)).sessions[0].status, 'failed');
  assert.equal((await readFile(join(runtime, 'state.json'))).equals(originalState), true, 'GET requests must not alter state bytes');
  const output = 'test-results/task-session-stream'; await mkdir(output, { recursive: true });
  await writeFile(join(output, 'http-result.json'), JSON.stringify({ passed: true, at: new Date().toISOString(), realServer: true, nativeExecution: false, nativeFiles: 'isolated protocol fixture', businessPosts: 0, stateFileUnchanged: true, checks: ['actual GET route', 'incremental append', 'cursor dedup', 'role/task/node isolation', 'native failure remains explicit', 'no-store'] }, null, 2));
  console.log('PASS read-only session stream HTTP scope, append, cursor, errors; no business writes');
} finally {
  if (server.exitCode === null) await new Promise<void>(resolve => { server.once('exit', () => resolve()); server.kill('SIGTERM'); });
  await rm(runtime, { recursive: true, force: true });
}
