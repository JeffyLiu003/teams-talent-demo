import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID,createHash } from 'node:crypto';
import { nativeTaskSessionDocuments } from '../server/task-session-documents.js';
import type { CollectedSession } from '../src/task-automation.js';

test('native upload reads exact completed session bytes, verifies scope and rejects unfinished or foreign content',async()=>{
 const runtime=await mkdtemp(join(tmpdir(),'task-session-doc-'));const runId=randomUUID(),sessionId=randomUUID(),scope={projectId:'carddemo',taskId:'MKT-TEST-001'};
 const root=join(runtime,'work-contexts',runId+'.native'),sessionRoot=join(root,'session-root'),path=join(sessionRoot,'sessions',sessionId.replaceAll('-','').slice(0,12),'session.json');
 const content=JSON.stringify({meta:{session_id:sessionId},state:{messages:[{content:'真实格式测试材料；只验证读取，不代表原生执行'}]}},null,2)+'\n';
 const session:CollectedSession={tool:'icode',sessionId,nodeIds:['develop','verify'],runIds:[runId],sources:['Teams CLI 回传'],firstAt:'2026-10-27T00:00:00Z',lastAt:'2026-10-27T00:01:00Z'};
 try{
  await mkdir(join(path,'..'),{recursive:true});await writeFile(path,content);
  const owner={...scope,runId,sessionId,sessionRoot,source:'icode-active-session-owner'};
  await writeFile(join(root,'native-session.json'),JSON.stringify(owner));await writeFile(join(root,'result.json'),JSON.stringify({runId,sessionId,status:'completed'}));
  const docs=await nativeTaskSessionDocuments(runtime,scope,[session]);assert.deepEqual(docs,[{sessionId,content,sha256:createHash('sha256').update(content).digest('hex')}]);
  await assert.rejects(nativeTaskSessionDocuments(runtime,{...scope,taskId:'MKT-FOREIGN'},[session]),/范围/);
  await writeFile(join(root,'result.json'),JSON.stringify({runId,sessionId,status:'running'}));await assert.rejects(nativeTaskSessionDocuments(runtime,scope,[session]),/完成回执/);
  await writeFile(join(root,'result.json'),JSON.stringify({runId,sessionId,status:'completed'}));await writeFile(path,JSON.stringify({meta:{session_id:randomUUID()}}));await assert.rejects(nativeTaskSessionDocuments(runtime,scope,[session]),/正文身份/);
  await assert.rejects(nativeTaskSessionDocuments(runtime,scope,[{...session,tool:'opencode'}]),/可核验/);
 }finally{await rm(runtime,{recursive:true,force:true});}
});
