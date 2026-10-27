import { createHash } from 'node:crypto';
import { readFile,realpath,stat } from 'node:fs/promises';
import { join,resolve,sep } from 'node:path';
import type { CollectedSession,TaskScope } from '../src/task-automation.js';
import type { TalentTaskSessionPayload } from '../src/talent-contract.js';
/** Reads only native launch records created under this Teams runtime, never arbitrary CLI file paths. */
export async function nativeTaskSessionDocuments(runtime:string,scope:TaskScope,sessions:CollectedSession[]):Promise<NonNullable<TalentTaskSessionPayload['sessionDocuments']>>{
 const runtimeRoot=await realpath(runtime);
 const documents=new Map<string,{sessionId:string;sha256:string;content:string;mtime:number}>();
 for(const session of sessions){
  if(session.tool!=='icode'||!session.runIds.length||!/^[a-f0-9-]{36}$/i.test(session.sessionId))throw new Error('缺少可核验的原生 iCode 会话身份，未上报会话正文');
  for(const runId of session.runIds){
   if(!/^[a-f0-9-]{36}$/i.test(runId))throw new Error('原生运行标识无效');
   const runRoot=await realpath(join(runtime,'work-contexts',runId+'.native'));
   const expected=resolve(runtimeRoot,'work-contexts',runId+'.native');if(runRoot!==expected)throw new Error('原生运行目录不允许符号链接替换');
   const owner=JSON.parse(await readFile(join(runRoot,'native-session.json'),'utf8')),result=JSON.parse(await readFile(join(runRoot,'result.json'),'utf8'));
   if(owner.source!=='icode-active-session-owner'||owner.projectId!==scope.projectId||owner.taskId!==scope.taskId||owner.runId!==runId||owner.sessionId!==session.sessionId||owner.sessionRoot!==join(runtime,'work-contexts',runId+'.native','session-root')||result.runId!==runId||result.sessionId!==session.sessionId||result.status!=='completed')throw new Error('原生会话范围或完成回执不匹配，未上报会话正文');
   const path=await realpath(join(owner.sessionRoot,'sessions',session.sessionId.replaceAll('-','').slice(0,12),'session.json'));
   if(!path.startsWith(join(runRoot,'session-root')+sep))throw new Error('会话文件超出当前运行目录');
   const info=await stat(path);if(!info.isFile()||info.size>8*1024*1024)throw new Error('原生会话文件无效或超过 8 MiB');
   const content=await readFile(path,'utf8'),parsed=JSON.parse(content);if(parsed?.meta?.session_id!==session.sessionId)throw new Error('原生会话正文身份不匹配');
   const current=documents.get(session.sessionId);if(!current||info.mtimeMs>current.mtime)documents.set(session.sessionId,{sessionId:session.sessionId,sha256:createHash('sha256').update(content).digest('hex'),content,mtime:info.mtimeMs});
  }
 }
 return [...documents.values()].map(({mtime,...document})=>document);
}
