import {useEffect,useState} from 'react';
import {useDemo} from '../context.js';
import {getTaskNodeInputs} from '../api.js';
import type {TalentNodeInputs} from '../talent-node-inputs.js';
import type {RequirementNode} from '../delivery-requirements.js';
export function useTaskNodeInputs(projectId:string,taskId:string,nodeId:RequirementNode){
 const {role,state}=useDemo(),key=[projectId,taskId,nodeId,role].join('/');
 const [loaded,setLoaded]=useState<{key:string;value?:TalentNodeInputs;error?:string}>(),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;setLoaded(undefined);getTaskNodeInputs(role,{projectId,taskId,nodeId}).then(value=>{if(active)setLoaded({key,value});},error=>{if(active)setLoaded({key,error:(error as Error).message});});return()=>{active=false;};},[key,state.revision,attempt]);
 return{value:loaded?.key===key?loaded.value:undefined,error:loaded?.key===key?loaded.error:undefined,pending:loaded?.key!==key,refresh:()=>setAttempt(value=>value+1)};
}
