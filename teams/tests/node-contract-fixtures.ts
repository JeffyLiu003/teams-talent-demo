import { taskNodeDefinitions } from '../src/task-node-contract.js';
import type { RequirementNode } from '../src/delivery-requirements.js';
/** Explicit HTTP contract fixtures; never native execution or actual remote reports. */
export function nodeResultFixture(node:RequirementNode, options:{failed?:boolean;codeVersion?:string}={}) {
 const definition=taskNodeDefinitions[node],codeVersion=options.codeVersion??'protocol-code-v1';
 const evidence=definition.deliverableRequirements.map(item=>({kind:'reference' as const,value:'fixture://isolated-contract/'+item.artifact,description:'隔离协议夹具 · '+item.label+'；不是实际模型执行或远端报告',artifact:item.artifact,version:'fixture-v1',source:(['code-review-report','security-report','issues-retest'].includes(item.artifact)?'preset':'actual') as 'preset'|'actual',...(node==='develop'||node==='verify'?{codeVersion}:{})}));
 return {evidence,completedCriteria:definition.completionCriteria.filter(item=>!options.failed||item.id!=='verify.current').map(item=>item.id),...(node==='verify'?{checks:['functional-test-report','code-review-report','security-report'].map(artifact=>({artifact,status:options.failed&&artifact==='functional-test-report'?'failed':'passed',source:artifact==='functional-test-report'?'actual':'preset',summary:'隔离协议断言；非外部检查执行'}))}:{})};
}
