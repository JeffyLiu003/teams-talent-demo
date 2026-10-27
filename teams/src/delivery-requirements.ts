import type { TalentTaskInputs } from './talent-contract.js';
import { DomainError, type DemoState, type Role } from './domain.js';
import { projectMembers } from './teams-domain.js';
export type RequirementNode = 'prepare' | 'develop' | 'verify' | 'accept';
export type RequirementStage = 'preparing' | 'developing' | 'verifying' | 'awaiting-acceptance' | 'accepted' | 'returned';
export interface RequirementNodeState { status:'pending'|'running'|'blocked'|'complete'|'waiting-owner'; updatedAt:string|null; summary:string }
export interface RequirementCheck { id:string; nodeId:RequirementNode; status:'passed'|'failed'; source:'actual'|'preset'; summary:string; at:string; sessionId:string|null }
export interface DeliveryRequirement {
 id:string;projectId:string;title:string;description:string;assigneeId:string;skillIds:string[];workDirectory?:string;
 talentInputsSnapshot?:TalentTaskInputs;
 stage:RequirementStage;createdAt:string;updatedAt:string;acceptedAt?:string;preparedAt?:string;inputDigest?:string;
 nodes:Record<RequirementNode,RequirementNodeState>;checks:RequirementCheck[];
 /** IDs from the current verification submission; empty means fresh checks are required. */
 verificationCheckIds?:string[];
}
export const requirementStageLabels:Record<RequirementStage,string>={preparing:'需求准备',developing:'功能开发',verifying:'测试验证','awaiting-acceptance':'待 Owner 验收',accepted:'已验收',returned:'已退回'};
export const deliveryRequirement=(state:DemoState,projectId:string,taskId?:string)=>(state.workspace.deliveryRequirements??[]).find(task=>task.projectId===projectId&&task.id===taskId);
export const requirementNode=(task:DeliveryRequirement):RequirementNode=>task.stage==='preparing'?'prepare':task.stage==='developing'||task.stage==='returned'?'develop':task.stage==='verifying'?'verify':'accept';
export function requireDeliveryMember(state:DemoState,task:DeliveryRequirement,role:Role){if(role!=='member'||task.assigneeId!=='member'||!projectMembers(state,task.projectId).some(member=>member.id==='member'&&member.status==='active'&&member.role==='member'))throw new DomainError('仅当前需求交付人可以回传工作状态',403);}
export function createDeliveryRequirement(state:DemoState,role:Role,input:Record<string,unknown>,at:string){
 if(role!=='owner')throw new DomainError('仅 Owner 可以创建交付需求',403);
 if(!input||typeof input!=='object'||Array.isArray(input))throw new DomainError('需求内容无效',400);
 const text=(key:string,max:number)=>{const value=input[key];if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f]/.test(value))throw new DomainError(key+'无效');return value.trim();};
 const projectId=text('projectId',100),id=text('id',100);if(projectId!=='carddemo'&&!state.workspace.projects?.some(p=>p.id===projectId))throw new DomainError('项目不支持创建本地交付需求');
 if(!/^MKT-[A-Z0-9][A-Z0-9-]{2,60}$/.test(id)||id==='MKT-001'||deliveryRequirement(state,projectId,id))throw new DomainError('需求标识无效或已存在');
 const assigneeId=text('assigneeId',100);if(!projectMembers(state,projectId).some(member=>member.id===assigneeId&&member.status==='active'&&member.role==='member'))throw new DomainError('请选择项目有效成员');
 if(!Array.isArray(input.skillIds)||input.skillIds.length===0||input.skillIds.length>20||input.skillIds.some(id=>typeof id!=='string'||!/^[a-z0-9-]+$/.test(id)))throw new DomainError('需要明确本需求选用的 Skill');
 const nodes=Object.fromEntries(['prepare','develop','verify','accept'].map(id=>[id,{status:'pending',updatedAt:null,summary:''}])) as DeliveryRequirement['nodes'];
 const task:DeliveryRequirement={id,projectId,title:text('title',160),description:text('description',4000),assigneeId,skillIds:[...new Set(input.skillIds as string[])],stage:'preparing',createdAt:at,updatedAt:at,nodes,checks:[],verificationCheckIds:[]};
 if(input.workDirectory!==undefined)task.workDirectory=text('workDirectory',2000);
 state.workspace.deliveryRequirements=[...(state.workspace.deliveryRequirements??[]),task];return task;
}
function verificationChecks(task:DeliveryRequirement):RequirementCheck[]{
 if(task.verificationCheckIds!==undefined)return task.checks.filter(check=>task.verificationCheckIds!.includes(check.id));
 // Existing records predate batch IDs. A single CLI submission stamped every check
 // with the same time/session; read its final contiguous batch without rewriting history.
 const last=task.checks.at(-1);if(!last)return [];
 let start=task.checks.length-1;while(start>0&&task.checks[start-1].at===last.at&&task.checks[start-1].sessionId===last.sessionId)start--;
 return task.checks.slice(start);
}
export function acceptDeliveryRequirement(state:DemoState,role:Role,task:DeliveryRequirement,at:string){
 if(role!=='owner')throw new DomainError('仅 Owner 可以验收需求',403);
 const checks=verificationChecks(task);
 if(task.stage!=='awaiting-acceptance'||task.nodes.develop.status!=='complete'||task.nodes.verify.status!=='complete'||!checks.length||checks.some(check=>check.status!=='passed'))throw new DomainError('需求尚未完成开发与验证，不能验收');
 task.stage='accepted';task.acceptedAt=at;task.updatedAt=at;task.nodes.accept={status:'complete',updatedAt:at,summary:'Owner 验收通过'};
}
export function returnDeliveryRequirement(role:Role,task:DeliveryRequirement,reason:unknown,at:string){
 if(role!=='owner'||task.stage!=='awaiting-acceptance')throw new DomainError('当前状态或角色不能退回',403);
 if(typeof reason!=='string'||!reason.trim())throw new DomainError('退回需要说明');
 task.stage='returned';task.updatedAt=at;task.verificationCheckIds=[];
 task.nodes.accept={status:'pending',updatedAt:at,summary:reason};task.nodes.develop={status:'running',updatedAt:at,summary:reason};task.nodes.verify={status:'pending',updatedAt:at,summary:'等待重新验证'};
}
export function applyRequirementProgress(task:DeliveryRequirement,input:{nodeId:RequirementNode;phase:'started'|'progress'|'blocked'|'result';summary:string;sessionId:string|null;checks?:unknown},at:string){
 const {nodeId,phase,summary}=input;if(nodeId==='accept')throw new DomainError('CLI不能替代Owner验收',403);
 if(task.stage==='accepted'||task.stage==='awaiting-acceptance')throw new DomainError('需求已提交验收，不能继续修改执行状态');
 if(nodeId!=='prepare'&&!task.preparedAt)throw new DomainError('请先在需求准备节点明确采用本次输入');
 if(nodeId==='verify'&&task.nodes.develop.status!=='complete')throw new DomainError('请先提交开发成果');
 let submitted:RequirementCheck[]|undefined;
 if(input.checks!==undefined){if(nodeId!=='verify'||!Array.isArray(input.checks)||input.checks.length===0||input.checks.length>30)throw new DomainError('检查结果必须属于验证节点');submitted=input.checks.map(raw=>{const check=raw as Record<string,unknown>;if(!check||!['passed','failed'].includes(String(check.status))||!['actual','preset'].includes(String(check.source))||typeof check.summary!=='string'||!check.summary.trim()||check.summary.length>2000)throw new DomainError('检查结果需要明确结论、来源与说明');return{id:crypto.randomUUID(),nodeId,status:check.status as 'passed'|'failed',source:check.source as 'actual'|'preset',summary:check.summary,at,sessionId:input.sessionId};});}
 if(nodeId==='develop'||nodeId==='verify'&&phase==='started')task.verificationCheckIds=[];
 if(submitted){task.checks.push(...submitted);task.verificationCheckIds=submitted.map(check=>check.id);}
 const checks=verificationChecks(task);
 if(nodeId==='verify'&&phase==='result'&&!checks.length)throw new DomainError('验证成果需要本轮新的检查结果及来源');
 const failed=nodeId==='verify'&&checks.some(check=>check.status==='failed');
 task.nodes[nodeId]={status:phase==='blocked'||failed?'blocked':phase==='result'?'complete':'running',updatedAt:at,summary};task.updatedAt=at;
 if(nodeId==='develop')task.stage=phase==='result'?'verifying':'developing';
 if(nodeId==='verify'){task.stage=phase==='result'&&!failed?'awaiting-acceptance':'verifying';if(task.stage==='awaiting-acceptance')task.nodes.accept={status:'waiting-owner',updatedAt:at,summary:'开发与验证成果已提交，等待 Owner 验收'};}
}
export function validateDeliveryRequirements(state:DemoState){
 if(state.workspace.deliveryRequirements===undefined)return;
 if(!Array.isArray(state.workspace.deliveryRequirements))throw new Error('交付需求记录无效');const ids=new Set<string>();
 for(const task of state.workspace.deliveryRequirements){if(!task||typeof task.id!=='string'||ids.has(task.projectId+'/'+task.id)||!Object.hasOwn(requirementStageLabels,task.stage)||!projectMembers(state,task.projectId).some(member=>member.id===task.assigneeId&&member.status==='active'&&member.role==='member')||!Array.isArray(task.skillIds)||!Array.isArray(task.checks)||!['prepare','develop','verify','accept'].every(id=>task.nodes?.[id as RequirementNode]&&['pending','running','blocked','complete','waiting-owner'].includes(task.nodes[id as RequirementNode].status)))throw new Error('交付需求记录损坏；未自动覆盖');
  if(task.verificationCheckIds!==undefined&&(!Array.isArray(task.verificationCheckIds)||new Set(task.verificationCheckIds).size!==task.verificationCheckIds.length||task.verificationCheckIds.some((id,index)=>typeof id!=='string'||task.checks[task.checks.length-task.verificationCheckIds!.length+index]?.id!==id)))throw new Error('需求当前检查批次无效；未自动覆盖');
  ids.add(task.projectId+'/'+task.id);}
}
