import {DomainError,type DemoState} from '../src/domain.js';
import type {Presentation} from '../src/api.js';
import type {TalentNodeInputs} from '../src/talent-node-inputs.js';
import type {RequirementNode} from '../src/delivery-requirements.js';
import {talentOrigin} from './config.js';
import {talentNodeInputs} from './talent-node-inputs.js';
import {registeredTaskSkill} from './talent-intake.js';
import {projectKnowledge} from './shared-data.js';
/** Teams consumes Talents' published shared data. No removed Talent HTTP service is called. */
export async function readTalentNodeInputs(state:DemoState,data:Presentation,scope:{projectId:string;taskId:string;nodeId:RequirementNode}):Promise<TalentNodeInputs>{
 const project=scope.projectId==='carddemo'?state.workspace.project:scope.projectId==='teams'?data.teamsProject.project:state.workspace.projects?.find(item=>item.id===scope.projectId);
 if(!project)throw new DomainError('项目不存在',404);
 return talentNodeInputs({state,project:{id:scope.projectId,name:project.name,generation:state.talentGeneration??'initial'}},data,scope.taskId,scope.nodeId,talentOrigin,registeredTaskSkill,await projectKnowledge(scope.projectId));
}
