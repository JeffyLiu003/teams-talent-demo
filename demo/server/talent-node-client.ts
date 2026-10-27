import {DomainError} from '../src/domain.js';
import type {TalentNodeInputs} from '../src/talent-node-inputs.js';
import type {RequirementNode} from '../src/delivery-requirements.js';
import {talentOrigin} from './config.js';
export async function readTalentNodeInputs(scope:{projectId:string;taskId:string;nodeId:RequirementNode}):Promise<TalentNodeInputs>{
 const response=await fetch(talentOrigin+'/api/task-node-inputs?'+new URLSearchParams(scope),{signal:AbortSignal.timeout(5000),redirect:'error'});
 const value=await response.json();if(!response.ok)throw new DomainError(value.error??'Talent节点输入 HTTP '+response.status,response.status);
 if(value.projectId!==scope.projectId||value.taskId!==scope.taskId||value.nodeId!==scope.nodeId||!Array.isArray(value.skills)||!Array.isArray(value.knowledge?.assets)||!value.selection)throw new DomainError('Talent节点输入范围或结构无效',502);
 return value;
}
