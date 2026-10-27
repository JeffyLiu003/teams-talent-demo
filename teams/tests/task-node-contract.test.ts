import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initialState} from '../src/domain.js';
import {createDeliveryRequirement,acceptDeliveryRequirement} from '../src/delivery-requirements.js';
import {taskNodeView,nodeResultErrors,taskNodeDefinitions} from '../src/task-node-contract.js';
import {nodeResultFixture} from './node-contract-fixtures.js';
import {readFixtures} from '../server/http-shared.js';
import type {RequirementNode} from '../src/delivery-requirements.js';
const at='2026-10-27T00:00:00Z';
function setup(){const state=initialState(),task=createDeliveryRequirement(state,'owner',{projectId:'carddemo',id:'MKT-NODE-001',title:'节点合同',description:'只读测试要求；未确认事项保持待定',assigneeId:'member',skillIds:['dev-frontend-ui']},at);state.workspace.collaboration={adoptions:[],events:[],operations:[]};return{state,task};}
function add(fixture:ReturnType<typeof setup>,nodeId:RequirementNode,version='v1'){
 const result=nodeResultFixture(nodeId),id=randomUUID();fixture.state.workspace.collaboration!.events.push({id,operationId:randomUUID(),projectId:'carddemo',taskId:fixture.task.id,nodeId,role:'member',runId:'unit-run',sessionId:'unit-session',adoptionId:'unit-adoption',phase:'result',summary:'仅单元合同证据',blocker:null,evidence:result.evidence.map(item=>({...item,version})),completedCriteria:result.completedCriteria,at,revision:fixture.state.workspace.collaboration!.events.length+1});return id;
}
test('upstream PRD uses one stable event reference and exact version across downstream nodes, without cross-task leakage',()=>{
 const f=setup(),id=add(f,'prepare');
 const dev=taskNodeView(f.state,f.task,'develop').inputs.find(item=>item.id==='prd')!.references[0],verify=taskNodeView(f.state,f.task,'verify').inputs.find(item=>item.id==='prd')!.references[0];
 assert.equal(dev.id,'artifact:'+id+':0');assert.deepEqual(dev,verify);assert.equal(dev.version,'v1');
 add(f,'prepare','v2');assert.equal(taskNodeView(f.state,f.task,'develop').inputs.find(item=>item.id==='prd')!.references[0].version,'v2');assert.equal(taskNodeView(f.state,f.task,'develop').artifacts.length,2);
 const other={...f.task,id:'MKT-NODE-OTHER'};assert.equal(taskNodeView(f.state,other,'develop').inputs.find(item=>item.id==='prd')!.references.length,0);
});
test('result gate requires registered outputs and explicit criteria; code and report source versions remain consistent',()=>{
 const f=setup(),definition=taskNodeDefinitions.prepare;
 assert.match(nodeResultErrors(f.state,f.task,'prepare',[],[],undefined).join(' '),/PRD/);
 assert.deepEqual(nodeResultErrors(f.state,f.task,'prepare',nodeResultFixture('prepare').evidence,definition.completionCriteria.map(item=>item.id),undefined),[]);
 add(f,'prepare');add(f,'develop');
 const verify=nodeResultFixture('verify');assert.deepEqual(nodeResultErrors(f.state,f.task,'verify',verify.evidence,verify.completedCriteria,verify.checks),[]);
 assert.match(nodeResultErrors(f.state,f.task,'verify',verify.evidence.map(item=>({...item,codeVersion:'another-commit'})),verify.completedCriteria,verify.checks).join(' '),/代码版本不一致/);
 assert.match(nodeResultErrors(f.state,f.task,'verify',verify.evidence,verify.completedCriteria,verify.checks!.map(item=>({...item,source:'actual'}))).join(' '),/来源不一致/);
 const failed=nodeResultFixture('verify',{failed:true});assert.deepEqual(nodeResultErrors(f.state,f.task,'verify',failed.evidence,failed.completedCriteria,failed.checks),[]);assert.match(nodeResultErrors(f.state,f.task,'verify',failed.evidence,verify.completedCriteria,failed.checks).join(' '),/存在失败/);
});
test('historical completion and unclassified skills do not fabricate PRD, quality capabilities or another project code graph',async()=>{
 const f=setup();f.task.nodes.prepare.status='complete';
 f.state.workspace.taskAutomation=[{projectId:'carddemo',taskId:f.task.id,sessions:[],knowledge:{id:'input',attempts:1,status:'ready',startedAt:at,finishedAt:at,inputs:{mode:'preparation',contextId:null,requirement:f.task.title,knowledgeStatus:'available',knowledge:[],skills:[{id:'dev-frontend-ui',version:'1.0',available:true},{id:'office-word',version:'example',available:false}],references:[],materials:[],notes:[]}}}];
 const view=taskNodeView(f.state,f.task,'prepare');assert.equal(view.deliverables[0].status,'unregistered');assert.equal(view.inputs.find(item=>item.id==='business-skills')!.references.length,0);assert.equal(view.inputs.some(item=>item.id==='other-skills'),false);assert.ok(view.criteria.every(item=>item.status==='unregistered'));
 const data=await readFixtures(),other={...f.task,projectId:randomUUID()};assert.equal(taskNodeView(f.state,other,'develop',data).inputs.find(item=>item.id==='code')!.references.length,0);assert.equal(taskNodeView(f.state,f.task,'verify').inputs.find(item=>item.id==='quality-skills')!.references.length,0);
});
test('old actual awaiting acceptance keeps its history, while new node-contract tasks cannot accept missing reports',()=>{
 const f=setup();f.task.stage='awaiting-acceptance';f.task.nodes.develop.status='complete';f.task.nodes.verify.status='complete';f.task.checks=[{id:'check',nodeId:'verify',status:'passed',source:'actual',summary:'已有真实检查',at,sessionId:'preserved-native-session'}];f.task.verificationCheckIds=['check'];
 const protectedHistory=JSON.stringify(f.task.checks);acceptDeliveryRequirement(f.state,'owner',f.task,at);assert.equal(f.task.stage,'accepted');assert.equal(JSON.stringify(f.task.checks),protectedHistory);
 f.task.stage='awaiting-acceptance';f.task.nodeContractVersion='delivery-node-v1';assert.throws(()=>acceptDeliveryRequirement(f.state,'owner',f.task,at),/依据不齐全/);
});
