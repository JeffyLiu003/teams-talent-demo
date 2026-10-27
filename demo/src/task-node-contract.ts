import type {TalentNodeInputs} from './talent-node-inputs.js';
import type { DemoState } from './domain.js';
import type { Presentation } from './api.js';
import type { CollaborationEvidence } from './collaboration.js';
import type { DeliveryRequirement, RequirementNode } from './delivery-requirements.js';
import { taskAutomation } from './task-automation.js';
import { createSourcePluginCatalog } from './source-plugins.js';
import { legacyAssetSourceIds } from './project-asset-links.js';

export const taskNodeContractVersion = 'delivery-node-v1' as const;
export const taskArtifactKinds = ['prd','software-design','code-change','unit-test-result','functional-test-report','code-review-report','security-report','issues-retest','owner-decision','delivery-manifest'] as const;
export type TaskArtifactKind = typeof taskArtifactKinds[number];
export interface TaskNodeDefinition {
 id:RequirementNode; label:string; inputRequirements:{id:string;label:string}[];
 deliverableRequirements:{id:string;label:string;artifact:TaskArtifactKind}[];
 completionCriteria:{id:string;label:string}[];
}
export const taskNodeDefinitions:Record<RequirementNode,TaskNodeDefinition>={
 prepare:{id:'prepare',label:'需求澄清',inputRequirements:[{id:'requirement',label:'原始需求'},{id:'business-documents',label:'业务文档与业务规则'},{id:'business-skills',label:'相关业务 Skill'}],deliverableRequirements:[{id:'prd',artifact:'prd',label:'PRD：目标、范围、规则、验收标准、待确认项'}],completionCriteria:[{id:'prepare.boundaries',label:'需求边界明确，PRD 覆盖目标、范围、规则、验收标准及待确认项'},{id:'prepare.confirmed',label:'影响开发的关键事项已有明确确认依据；未确认事项不按已确认处理'}]},
 develop:{id:'develop',label:'功能开发',inputRequirements:[{id:'prd',label:'已确认 PRD'},{id:'code',label:'存量代码与代码图谱'},{id:'development-knowledge',label:'范式开发场景知识'},{id:'project-standards',label:'项目开发规范'}],deliverableRequirements:[{id:'software-design',artifact:'software-design',label:'软件设计文档'},{id:'code-change',artifact:'code-change',label:'GitHub 代码 PR 或提交'},{id:'unit-test-result',artifact:'unit-test-result',label:'单元测试及结果'}],completionCriteria:[{id:'develop.prd',label:'实现与已确认 PRD 对应'},{id:'develop.traceable',label:'设计、代码 PR／提交和单元测试结果可追踪至同一代码版本'},{id:'develop.verifiable',label:'具备测试验证条件，剩余限制已明确说明'}]},
 verify:{id:'verify',label:'测试验证',inputRequirements:[{id:'prd',label:'PRD 验收标准'},{id:'software-design',label:'软件设计文档'},{id:'code-change',label:'待检查代码版本'},{id:'test-cases',label:'企业平台测试用例或按 PRD 补充的用例'},{id:'project-standards',label:'项目规范'},{id:'quality-skills',label:'Review／测试／安全 Skill'}],deliverableRequirements:[{id:'functional-test-report',artifact:'functional-test-report',label:'功能测试报告'},{id:'code-review-report',artifact:'code-review-report',label:'代码检视报告'},{id:'security-report',artifact:'security-report',label:'安全报告'},{id:'issues-retest',artifact:'issues-retest',label:'发现问题与复测结果（无问题也需明确记录）'}],completionCriteria:[{id:'verify.complete',label:'功能、代码检视与安全检查范围齐全，实际执行与预置来源明确'},{id:'verify.blockers',label:'阻塞交付的问题已处理，并保留问题与复测依据'},{id:'verify.current',label:'本轮全部检查通过且指向待验收的同一代码版本'}]},
 accept:{id:'accept',label:'需求验收',inputRequirements:[{id:'prd',label:'PRD 验收标准'},{id:'functional-test-report',label:'功能测试结果'},{id:'code-review-report',label:'代码检视结果'},{id:'security-report',label:'安全结果'},{id:'code-change',label:'交付 PR／提交'}],deliverableRequirements:[{id:'owner-decision',artifact:'owner-decision',label:'Owner 验收结论或退回原因'},{id:'delivery-manifest',artifact:'delivery-manifest',label:'交付清单：引用本需求已登记的产物版本'}],completionCriteria:[{id:'accept.decision',label:'Owner 对照验收依据明确通过或退回；CLI 不能代替确认'}]},
};
export interface TaskNodeReference {
 id:string;title:string;artifact?:TaskArtifactKind;kind:'reference'|'local-file'|'record';value?:string;description:string;version:string|null;codeVersion?:string;
 source:'actual'|'preset'|'owner'|'legacy';sourceNode?:RequirementNode;sourceLabel:string;
}
export interface TaskNodeItem {id:string;label:string;status:'ready'|'missing'|'unregistered';references:TaskNodeReference[]}
export interface TaskNodeView {definition:TaskNodeDefinition;inputs:TaskNodeItem[];deliverables:TaskNodeItem[];criteria:{id:string;label:string;status:'reported'|'pending'|'unregistered';evidenceIds:string[]}[];artifacts:TaskNodeReference[]}
export function taskArtifacts(state:DemoState,task:DeliveryRequirement):TaskNodeReference[]{
 const events=(state.workspace.collaboration?.events??[]).filter(event=>event.projectId===task.projectId&&event.taskId===task.id&&event.phase==='result');
 return events.flatMap(event=>event.evidence.map((evidence,index)=>({id:'artifact:'+event.id+':'+index,title:evidence.description,artifact:evidence.artifact,kind:evidence.kind,value:evidence.value,description:evidence.description,version:evidence.version??null,...(evidence.codeVersion?{codeVersion:evidence.codeVersion}:{}),source:evidence.source??'legacy',sourceNode:event.nodeId as RequirementNode,sourceLabel:evidence.source==='preset'?'CLI 预置检查记录':evidence.source==='actual'?'CLI 实际成果回传':'历史未分类成果引用'})));
}
export function latestTaskArtifacts(state:DemoState,task:DeliveryRequirement):TaskNodeReference[]{
 const latest=new Map<string,TaskNodeReference>();for(const item of taskArtifacts(state,task))if(item.artifact)latest.set(item.artifact,item);return [...latest.values()];
}
export function taskNodeView(state:DemoState,task:DeliveryRequirement,node:RequirementNode,data?:Presentation,nodeInputs?:TalentNodeInputs|null):TaskNodeView{
 const definition=taskNodeDefinitions[node],artifacts=taskArtifacts(state,task),latest=latestTaskArtifacts(state,task),auto=taskAutomation(state,{projectId:task.projectId,taskId:task.id})?.knowledge?.inputs;
 const ref=(id:string,title:string,description:string,version:string|null,sourceLabel:string):TaskNodeReference=>({id,title,kind:'record',description,version,source:'actual',sourceLabel});
 const requirement=ref('requirement:'+task.projectId+':'+task.id,task.title,task.description,task.createdAt,'任务原始需求');
 const projectAssets=task.projectId==='carddemo'?state.workspace.project.assets:state.workspace.projects?.find(item=>item.id===task.projectId)?.assets??[];
 const catalog=data?createSourcePluginCatalog(data):null;
 const sourceRefs=projectAssets.flatMap(asset=>legacyAssetSourceIds(asset).flatMap(id=>{const item=catalog?.get(id);return item?[{...ref(item.id,item.title,item.summary,item.version??null,'项目关联来源 · '+item.pluginId),sourceKind:item.kind}]:[]}));
 const upstream=(kind:string)=>latest.filter(item=>item.artifact===kind);
 const mapping:Record<string,TaskNodeReference[]>={requirement:[requirement],
  prd:upstream('prd'),code:[...sourceRefs.filter(item=>item.sourceKind==='repository'||item.sourceKind==='code'),...(sourceRefs.some(item=>item.id==='repository:carddemo:carddemo-java-1025')?data?.graph??[]:[]).map(item=>ref('graph:'+item.id,item.name,item.description,null,'已有代码图谱／源码节选'))],
  'software-design':upstream('software-design'),'code-change':upstream('code-change'),'test-cases':sourceRefs.filter(item=>item.sourceKind==='test-case'),'functional-test-report':upstream('functional-test-report'),'code-review-report':upstream('code-review-report'),'security-report':upstream('security-report')};
 const toItem=(item:{id:string;label:string},references:TaskNodeReference[]):TaskNodeItem=>({...item,status:references.length?'ready':task.nodes[node].status==='complete'?'unregistered':'missing',references});
 const inputs=definition.inputRequirements.map(item=>toItem(item,mapping[item.id]??[]));
 applyTalentNodeInputs(inputs,nodeInputs);
 const own=latest.filter(item=>item.sourceNode===node);
 if(node==='accept'&&(task.stage==='accepted'||task.stage==='returned'))own.push({...ref('owner-decision:'+task.projectId+':'+task.id+':'+(task.acceptedAt??task.nodes.accept.updatedAt),task.stage==='accepted'?'Owner 验收通过':'Owner 退回',task.nodes.accept.summary,task.acceptedAt??task.nodes.accept.updatedAt,'Owner 任务确认记录'),artifact:'owner-decision',source:'owner',sourceNode:'accept'});
 if(node==='accept'&&task.stage==='accepted'&&latest.length)own.push({...ref('delivery-manifest:'+task.projectId+':'+task.id+':'+task.acceptedAt,'已登记交付清单',latest.map(item=>item.id).join('\n'),task.acceptedAt??null,'同一任务产物引用清单'),artifact:'delivery-manifest',source:'owner',sourceNode:'accept'});
 const event=[...(state.workspace.collaboration?.events??[])].reverse().find(event=>event.projectId===task.projectId&&event.taskId===task.id&&event.nodeId===node&&event.phase==='result');
 return {definition,inputs,deliverables:definition.deliverableRequirements.map(item=>toItem(item,own.filter(value=>value.artifact===item.artifact))),criteria:definition.completionCriteria.map(item=>({...item,status:node==='accept'&&(task.stage==='accepted'||task.stage==='returned')||event?.completedCriteria?.includes(item.id)?'reported':task.nodes[node].status==='complete'?'unregistered':'pending',evidenceIds:own.map(item=>item.id)})),artifacts};
}

/** Validate declared evidence, not the content of a remote report or Git provider. */
export function nodeResultErrors(state:DemoState,task:DeliveryRequirement,node:RequirementNode,evidence:CollaborationEvidence[],completedCriteria:readonly string[],checks:unknown):string[]{
 const definition=taskNodeDefinitions[node],errors:string[]=[];
 const failed=node==='verify'&&Array.isArray(checks)&&checks.some(check=>check?.status==='failed');
 if(failed&&completedCriteria.includes('verify.current'))errors.push('存在失败检查，不能声明本轮全部检查通过');
 for(const required of failed?[]:definition.deliverableRequirements)if(!evidence.some(item=>item.artifact===required.artifact))errors.push('缺少交付物：'+required.label);
 for(const required of failed?[]:definition.completionCriteria)if(!completedCriteria.includes(required.id))errors.push('尚未明确完成标准：'+required.label);
 const latest=latestTaskArtifacts(state,task);
 const requiredUpstream=node==='develop'?['prd']:node==='verify'?['prd','software-design','code-change']:[];
 for(const id of requiredUpstream)if(!latest.some(item=>item.artifact===id))errors.push('缺少上游产物：'+id);
 const code=node==='develop'?evidence.find(item=>item.artifact==='code-change'):latest.find(item=>item.artifact==='code-change');
 if(node==='develop'||node==='verify'){
  if(!code?.codeVersion)errors.push('需要明确代码 PR／提交的 codeVersion');
  for(const item of evidence.filter(item=>item.artifact&&item.artifact!=='prd'))if(item.codeVersion!==code?.codeVersion)errors.push('产物代码版本不一致：'+item.description);
 }
 if(node==='verify'&&!failed)for(const artifact of ['functional-test-report','code-review-report','security-report']){
  const report=evidence.find(item=>item.artifact===artifact),matches=Array.isArray(checks)?checks.filter(item=>item?.artifact===artifact):[];
  if(!matches.length)errors.push('缺少报告对应的检查结论：'+artifact);
  if(report&&matches.some(item=>item.source!==report.source))errors.push('报告与检查来源不一致：'+artifact);
 }
 return errors;
}

/** Both UI and CLI place the exact Talent response in its declared node slots. */
export function applyTalentNodeInputs(inputs:TaskNodeItem[],value?:TalentNodeInputs|null){
 if(!value)return;
 const add=(slot:string,label:string,reference:TaskNodeReference)=>{let item=inputs.find(item=>item.id===slot);if(!item){item={id:slot,label,status:'missing',references:[]};inputs.push(item);}item.references.push(reference);item.status='ready';};
 for(const selected of value.selection.knowledge){const asset=value.knowledge.assets.find(item=>item.id===selected.id);if(!asset)continue;add(selected.slot,selected.slot==='verification-knowledge'?'本需求验证知识':selected.slot==='acceptance-knowledge'?'验收口径与清单':'节点知识',{id:asset.id,title:asset.title,description:asset.detail+'\n关联理由：'+selected.reason,kind:'record',version:asset.version??null,source:value.selection.basis==='historical-subset'?'legacy':'preset',sourceLabel:value.selection.basis==='historical-subset'?'历史采用知识 · 当前节点相关部分':'Talent 节点知识',value:JSON.stringify({scope:{projectId:value.projectId,taskId:value.taskId,nodeId:value.nodeId},selection:value.selection.source,version:value.selection.version,origin:asset.origin,reason:selected.reason})});}
 for(const selected of value.selection.skills){const skill=value.skills.find(item=>item.id===selected.id);if(!skill)continue;add(selected.slot,selected.slot==='development-skills'?'设计与开发 Skill':selected.slot==='acceptance-skills'?'验收 Skill':'节点 Skill',{id:skill.id,title:skill.name,description:selected.reason,kind:'record',version:skill.version,source:value.selection.basis==='historical-subset'?'legacy':'actual',sourceLabel:value.selection.basis==='historical-subset'?'历史采用 Skill · 当前节点相关部分':'Talent 节点 Skill',value:JSON.stringify({source:skill.source,sha256:skill.sha256,contentSha256:skill.contentSha256,nodeId:value.nodeId,reason:selected.reason})});}
}
