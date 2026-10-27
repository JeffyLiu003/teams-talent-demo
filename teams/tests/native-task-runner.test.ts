import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
const exec=promisify(execFile);
// Transport-only fixture. Real iCode/Ghostty execution is verified separately.
test('native observer pins the prompt, captures native-owned session/exit and refuses duplicate execution', async()=>{
  const temporary=await mkdtemp(join(tmpdir(),'native-run-')),dir=await realpath(temporary), output=join(dir,'output'),task=join(dir,'task.md'),fixture=join(dir,'run'),executable=process.execPath;
  const sessionId=randomUUID(),runId=randomUUID(),prompt='Read the scoped task';
  try {
    await mkdir(output);await writeFile(task,prompt);
    // Node executes the first production argument, "run", as this CommonJS file on every platform.
    await writeFile(fixture,`const{mkdir,writeFile}=require('node:fs/promises');const{join}=require('node:path');(async()=>{const root=process.env.CHRYS_SESSION_ROOT_DIR;await writeFile(join(root,'fixture-invocation.json'),JSON.stringify({entry:process.argv[1],args:process.argv.slice(2),directory:process.cwd()}));await mkdir(join(root,'sessions','.locks'),{recursive:true});await writeFile(join(root,'sessions','.locks','fixture.active.json'),JSON.stringify({session_id:${JSON.stringify(sessionId)},pid:process.pid,started_at:new Date().toISOString()}));await new Promise(r=>setTimeout(r,300));process.stdout.write(JSON.stringify({session_id:${JSON.stringify(sessionId)},result:'transport complete'}));})().catch(error=>{console.error(error);process.exitCode=1;});`);
    const manifest={version:1,runId,scope:{projectId:'carddemo',taskId:'MKT-E2E-UNIT',nodeId:'prepare'},directory:dir,executable,agent:'unit',model:'unit',taskFile:task,taskSha256:createHash('sha256').update(prompt).digest('hex')},path=join(output,'manifest.json');await writeFile(path,JSON.stringify(manifest));
    await exec(process.execPath,[resolve('scripts/native/run-project-task.mjs'),path]);
    const observed=JSON.parse(await readFile(join(output,'native-session.json'),'utf8')),result=JSON.parse(await readFile(join(output,'result.json'),'utf8')),launch=JSON.parse(await readFile(join(output,'process.json'),'utf8'));
    const invocation=JSON.parse(await readFile(join(output,'session-root','fixture-invocation.json'),'utf8'));
    assert.equal(observed.sessionId,sessionId);assert.equal(observed.runId,runId);for(const [key,value] of Object.entries(manifest.scope)){assert.equal(observed[key],value);assert.equal(result[key],value);}assert.equal(result.sessionId,sessionId);assert.equal(result.status,'completed');assert.equal(result.nativeExitCode,0);assert.equal(result.pid,observed.pid);assert.equal(launch.executable,process.execPath);assert.deepEqual(launch.args,['run','--task',task,'--agent','unit','--model','unit','-C',dir,'--json']);
    assert.equal(await realpath(invocation.entry),fixture);assert.equal(await realpath(invocation.directory),dir);assert.deepEqual(invocation.args,launch.args.slice(1));
    await assert.rejects(exec(process.execPath,[resolve('scripts/native/run-project-task.mjs'),path]),/EEXIST/);
    await writeFile(task,'changed');await assert.rejects(exec(process.execPath,[resolve('scripts/native/run-project-task.mjs'),path]),/prompt changed/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
