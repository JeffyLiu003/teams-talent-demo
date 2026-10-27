#!/usr/bin/env node
// Observe an actual iCode run. This launcher never calls a Teams business API.
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream, constants } from 'node:fs';
import { access, mkdir, open, readFile, readdir, realpath, rename } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function atomicJson(path, value) {
  const temporary = path + '.' + randomUUID() + '.tmp', handle = await open(temporary, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(value, null, 2) + '\n'); await handle.sync(); } finally { await handle.close(); }
  await rename(temporary, path);
}
export async function runProjectTask(manifestPath) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const directory = await realpath(manifest.directory), output = await realpath(dirname(manifestPath));
  if (manifest.version !== 1 || !/^[0-9a-f-]{36}$/i.test(manifest.runId) || !isAbsolute(manifest.executable) || !isAbsolute(manifest.taskFile) || !manifest.agent || !manifest.model || directory !== manifest.directory) throw new Error('Native task manifest is invalid');
  await access(manifest.executable, constants.X_OK);
  if (digest(await readFile(manifest.taskFile)) !== manifest.taskSha256) throw new Error('Task prompt changed after confirmation; native run was not started');
  const sentinel = await open(join(output, 'started.json'), 'wx', 0o600);
  const startedAt = new Date().toISOString();
  try { await sentinel.writeFile(JSON.stringify({ runId: manifest.runId, startedAt })); await sentinel.sync(); } finally { await sentinel.close(); }
  const sessionRoot = join(output, 'session-root');
  await mkdir(sessionRoot);
  const args = ['run', '--task', manifest.taskFile, '--agent', manifest.agent, '--model', manifest.model, '-C', directory, '--json'];
  const stdout = createWriteStream(join(output, 'stdout.json'), { flags: 'wx', mode: 0o600 });
  const stderr = createWriteStream(join(output, 'stderr.log'), { flags: 'wx', mode: 0o600 });
  let outputText = '', session, observerError, done = false;
  const child = spawn(manifest.executable, args, { cwd: directory, env: { ...process.env, CHRYS_SESSION_ROOT_DIR: sessionRoot }, stdio: ['ignore', 'pipe', 'pipe'] });
  const finished = new Promise(resolve => { child.once('error', error => resolve({ code: null, signal: null, error: error.message })); child.once('close', (code, signal) => resolve({ code, signal })); });
  await atomicJson(join(output, 'process.json'), { runId: manifest.runId, executable: manifest.executable, args, directory, pid: child.pid ?? null, startedAt, sessionRoot });
  child.stdout.on('data', bytes => { outputText += bytes.toString('utf8'); stdout.write(bytes); process.stdout.write(bytes); });
  child.stderr.on('data', bytes => { stderr.write(bytes); process.stderr.write(bytes); });
  const observe = (async () => {
    const locks = join(sessionRoot, 'sessions', '.locks');
    while (!done && !session) {
      let names;
      try { names = await readdir(locks); } catch (error) { if (error.code !== 'ENOENT') throw error; names = []; }
      const owners = await Promise.all(names.filter(name => name.endsWith('.active.json')).map(async name => JSON.parse(await readFile(join(locks, name), 'utf8'))));
      if (owners.length > 1) throw new Error('Multiple native sessions observed in this task run');
      if (owners.length === 1) {
        const owner = owners[0];
        if (!/^[0-9a-f-]{36}$/i.test(owner.session_id) || !Number.isSafeInteger(owner.pid) || owner.pid < 2 || Date.parse(owner.started_at) < Date.parse(startedAt) - 1000) throw new Error('Invalid native session ownership record');
        process.kill(owner.pid, 0);
        session = { runId: manifest.runId, ...manifest.scope, sessionId: owner.session_id, pid: owner.pid, startedAt: owner.started_at, source: 'icode-active-session-owner', sessionRoot };
        await atomicJson(join(output, 'native-session.json'), session);
      } else await new Promise(resolve => setTimeout(resolve, 100));
    }
  })().catch(error => { observerError = error.message; });
  const result = await finished;
  done = true; await observe;
  await Promise.all([new Promise(resolve => stdout.end(resolve)), new Promise(resolve => stderr.end(resolve))]);
  let response;
  if (result.code === 0) {
    try { response = JSON.parse(outputText); } catch { observerError ??= 'iCode did not return a valid JSON result'; }
    if (!session || response?.session_id !== session.sessionId) observerError ??= 'iCode result and observed session ID do not match';
  }
  const receipt = { runId: manifest.runId, ...manifest.scope, startedAt, finishedAt: new Date().toISOString(), nativeExitCode: result.code, signal: result.signal, sessionId: session?.sessionId ?? null, pid: session?.pid ?? child.pid ?? null, status: result.code === 0 && !observerError ? 'completed' : 'failed', error: result.error ?? observerError ?? (result.code ? 'iCode exited unsuccessfully' : null), stdoutPath: join(output, 'stdout.json'), stderrPath: join(output, 'stderr.log') };
  await atomicJson(join(output, 'result.json'), receipt);
  return receipt;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { const result = await runProjectTask(process.argv[2]); process.exitCode = result.status === 'completed' ? 0 : result.nativeExitCode || 1; }
  catch (error) { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; }
}
