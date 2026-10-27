import type {Presentation} from '../src/api.js';
import {DomainError} from '../src/domain.js';
import {deliveryRequirement,type RequirementNode} from '../src/delivery-requirements.js';
import type {TalentIntegrationContext,TalentTaskInputs} from '../src/talent-contract.js';
import type {TalentNodeInputs} from '../src/talent-node-inputs.js';
import {nodePreset,nodePresetVersion} from './talent-node-presets.js';
import type {SkillBinding} from '../src/resource-sharing.js';

export function checkedNode(value:string):RequirementNode{if(!['prepare','develop','verify','accept'].includes(value))throw new DomainError('任务输入节点不存在',404);return value as RequirementNode;}
/** Exact scope selection; no model call, no project knowledge build, no state writes. */
export async function talentNodeInputs(ctx:TalentIntegrationContext,data:Pick<Presentation,'teamsProject'>,taskId:string,nodeId:RequirementNode,origin:string,loadSkill:(id:string,binding?:SkillBinding)=>Promise<TalentTaskInputs['skills'][number]>):Promise<TalentNodeInputs>{
 const projectId=ctx.project.id,task=deliveryRequirement(ctx.state,projectId,taskId),source=projectId==='teams'?data.teamsProject.tasks.find(item=>item.id===taskId):undefined;
 if(!task&&!source)throw new DomainError('任务不存在或不属于所选项目',404);
 const frozen=task?.nodeInputSnapshots?.[nodeId];
 if(frozen){if(frozen.projectId!==projectId||frozen.taskId!==taskId||frozen.nodeId!==nodeId)throw new DomainError('节点采用输入范围不一致',409);return {...structuredClone(frozen),origin,selection:{...structuredClone(frozen.selection),basis:'adopted-node'}};}
 const preset=nodePreset(projectId,taskId,nodeId),requirement={id:taskId,title:task?.title??source!.title,description:task?.description??[source!.goal,'范围：'+source!.scope].join('\n')};
 const base:TalentNodeInputs={projectId,taskId,nodeId,generation:ctx.project.generation,origin,requirement,knowledge:{status:'not-built',assets:[]},skills:[],selection:{version:nodePresetVersion,source:'preset-scenario',status:preset?'configured':'not-configured',basis:'recommendation',note:preset?'当前节点建议输入；明确采用前不属于执行依据。':'此任务与节点尚未配置相关输入。',missingSkillIds:[],knowledge:[],skills:[]}};
 if(!preset)return base;
 // Older task-wide snapshots are immutable. Select only matching recorded packages;
 // never silently substitute today's recommendation for what the agent adopted then.
 const historical=task?.talentInputsSnapshot&&!('nodeId' in task.talentInputsSnapshot)?task.talentInputsSnapshot:undefined;
 if(historical){
  base.knowledge={...structuredClone(historical.knowledge),assets:structuredClone(historical.knowledge.assets.filter(asset=>asset.sourceRecordId===taskId))};
  base.knowledge.status=base.knowledge.assets.length?'ready':'not-built';
  base.skills=structuredClone(historical.skills.filter(skill=>preset.skills.includes(skill.id)));
  base.selection.basis='historical-subset';base.selection.note='仅显示当前节点相关的历史采用内容；新建议未补写为当时采用。';base.selection.missingSkillIds=preset.skills.filter(id=>!base.skills.some(skill=>skill.id===id));
  base.selection.knowledge=base.knowledge.assets.map(asset=>({id:asset.id,slot:preset.knowledge[0]?.slot??'business-documents',nodeId,reason:'复核本需求历史采用的知识记录'}));
 }else{
  base.knowledge={status:preset.knowledge.length?'ready':'not-built',version:nodePresetVersion,assets:preset.knowledge.map(item=>({id:`talent-node:${projectId}:${taskId}:${nodeId}:${item.id}`,pluginId:'business-knowledge',sourceRecordId:taskId,kind:'knowledge',title:item.title,summary:item.reason,detail:item.content,sourceProjectId:projectId,sourceProjectName:ctx.project.name,origin:'plugin-mock',version:nodePresetVersion,references:[],relatedRequirementIds:[`requirements:${projectId}:${taskId}`]}))};
  base.selection.knowledge=base.knowledge.assets.map((asset,index)=>({id:asset.id,slot:preset.knowledge[index].slot,nodeId,reason:preset.knowledge[index].reason}));
  base.skills=await Promise.all(preset.skills.map(async id=>{
   return loadSkill(id,task?.skillBindings?.find(item=>item.id===id));
  }));
 }
 base.selection.skills=base.skills.map(skill=>({id:skill.id,slot:preset.skillSlot,nodeId,reason:'用于'+({prepare:'需求分析与验收标准',develop:'设计与实现',verify:'质量检查',accept:'业务验收'}[nodeId])+'，未声明工具已执行'}));
 return base;
}
