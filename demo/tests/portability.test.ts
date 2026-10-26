import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { readFixtures } from '../server/http-shared.js';
import { root, workspace, runtimeDir } from '../server/config.js';
// @ts-expect-error standalone Node startup scripts intentionally have no TypeScript declarations
import { serviceHealth } from '../scripts/services.mjs';

test('runtime fixture paths follow the material root rather than the imported machine',async()=>{
  const data=await readFixtures();assert.ok(data.skills.length>0);
  for(const skill of data.skills)assert.equal(skill.path,join(workspace,'skills',skill.name,'SKILL.md'));
  assert.equal(data.localPaths.cli,join(root,'scripts/teams-demo.mjs'));
  assert.equal(data.localPaths.collaborationSkill,join(root,'skills/teams-demo-collaboration/SKILL.md'));
});
test('launcher rejects a different workspace, state directory or app on an occupied port',async()=>{
  let value:any={app:'teams-talent-carddemo',workspaceRoot:root,stateRoot:runtimeDir};
  const server=createServer((_req,res)=>{res.setHeader('content-type','application/json');res.setHeader('connection','close');res.end(JSON.stringify(value));});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address() as {port:number},service={id:'teams',app:'teams-talent-carddemo',origin:'http://127.0.0.1:'+address.port,runtimeDir};
  try {assert.equal((await serviceHealth(service)).workspaceRoot,root);
    for(const other of [{...value,workspaceRoot:'/another/copy'},{...value,stateRoot:'/another/state'},{app:value.app},{...value,app:'another-app'}]){value=other;await assert.rejects(serviceHealth(service),/其他|旧版/);}
  }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
  assert.equal(await serviceHealth(service),null);
});
