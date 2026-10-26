import { availableSkillIds, projectSkillIds, resourcePublications, resourceVersion, shareableResourceIds, type ResourcePublication } from './resource-sharing.js';
import { externalPlatformDefault } from './external-platforms.js';
import { DomainError, type DemoState, type Role } from './domain.js';
import { createdProjectFields, createdProjectId, type CreatedProject } from './created-projects.js';
import type { SourcePluginAsset } from './source-plugins.js';
import { legacyAssetSourceIds } from './project-asset-links.js';
import type { CollaborationState } from './collaboration.js';

export interface Asset { id: string; title: string; kind: string; location: string; sourceAssetId?: string }
export interface Material { id: string; title: string; body: string }
export interface WorkspaceState {
  collaboration?: CollaborationState;
  acquiredResources: string[];
  resourcePublications?: ResourcePublication[];
  projects?: CreatedProject[];
  project: { name: string; description: string; repository: string; assets: Asset[] };
  materials: Material[]; selectedSkills: string[];
  progress: { id: string; text: string; at: string; node: string }[];
  sessionReported: boolean; reportAt: string | null;
  analysis: { scope: 'single' | 'project'; status: 'idle' | 'analyzed' };
  team: { name: string; members: { id: string; name: string; role: 'owner' | 'member'; status: 'active' | 'invited' }[] };
  connections: { id: string; name: string; kind: string; enabled: boolean; description: string }[];
  foundation: { progressEnabled: boolean; uploadEnabled: boolean };
}
export const defaultSkills = projectSkillIds;
export function initialWorkspace(): WorkspaceState {
  return {
    acquiredResources:[],project: { name: '信用卡营销交付', description: '针对白金卡客户未来 3 个月的消费，额外增加 0.5% 的消费返现。', repository: 'carddemo-java-1025', assets: [
      { id:'code',title:'CardDemo Java 项目',kind:'repository',location:'workspace/carddemo-java-1025' },
      { id:'design',title:'营销能力设计',kind:'document',location:'docs/design/08-marketing-capability.md' },
      { id:'history',title:'信用卡营销历史需求',kind:'requirement',location:'iCode / 6b82c08d-eb3b-4bdc-b373-54fed16a7fcd' },
      { id:'adr',title:'营销集成与鉴权范围',kind:'document',location:'ADR-009 / ADR-007' },
    ] }, materials: [], selectedSkills: [...defaultSkills], progress: [], sessionReported:false, reportAt:null,
    analysis:{scope:'single',status:'idle'}, foundation:{progressEnabled:true,uploadEnabled:true},
    team:{ name:'信用卡研发团队',members:[['owner','林悦'],['member','陈晨'],['su','苏晴'],['yang','杨帆'],['zhao','赵宁'],['wang','王晓']].map(([id,name])=>({id,name,role:id==='owner'?'owner':'member',status:'active'})) },
    connections: [
      ['repository','代码仓与项目资产','asset','使用导入的 CardDemo 代码快照。'],['requirements','需求与文档','asset','关联项目需求和设计资料。'],
      ['review','代码 Review','quality','检查业务状态、变更影响与事务边界，保留问题与修复依据。'],['test','测试与复测','quality','保留真实退出码、测试范围及结构化报告。'],
      ['security','安全扫描','quality','尚未提供安全扫描报告，需接入报告后核验。'],['model','组织模型服务','model','展示团队模型使用要求，真实凭据由原生工具管理。'],
      ['mcp','工具与 MCP','tool','按工具声明能力和权限，成员通过 iCode 调用。'],['talent','Talent 知识与演进','talent','依据 Teams 项目资产整合知识，分析轨迹并评估改进候选。'],
    ].map(([id,name,kind,description])=>({id,name,kind,description,enabled:true})),
  };
}
export const workspaceActions = ['project.create','project.metadata.update','project.update','asset.link','asset.add','material.add','skills.select','resource.publish','resource.acquire','team.update','member.invite','member.approve','member.role','member.remove','progress.sync','session.report','analysis.run','connection.update','foundation.update'] as const;
export type WorkspaceAction = typeof workspaceActions[number];
const ownerActions: WorkspaceAction[] = ['project.create','project.metadata.update','resource.publish','project.update','asset.link','asset.add','team.update','member.invite','member.approve','member.role','member.remove','analysis.run','connection.update'];
const memberActions: WorkspaceAction[] = ['material.add','skills.select','progress.sync','session.report'];
function need(ok:unknown,message:string):asserts ok { if(!ok)throw new DomainError(message); }
function text(p:Record<string,unknown>,key:string,max=1000){ const value=p[key];need(typeof value==='string'&&value.trim().length>0&&value.length<=max,`${key} 不能为空或超出长度`);return value.trim(); }
export function updateWorkspace(previous:DemoState,kind:WorkspaceAction,role:Role,p:Record<string,unknown>,sourceAssets:readonly SourcePluginAsset[]=[]):DemoState {
  need(workspaceActions.includes(kind),'未知工作区操作');
  if(ownerActions.includes(kind)&&role!=='owner'||memberActions.includes(kind)&&role!=='member')throw new DomainError('当前角色无权执行此操作',403);
  const s=structuredClone(previous),w=s.workspace,at=new Date().toISOString(),id='demo-'+(s.revision+1);
  const writableAssets = () => {
    const projectId = p.projectId ?? 'carddemo';
    need(projectId !== 'teams', '导入项目快照为只读');
    if (projectId === 'carddemo') return w.project.assets;
    const project = w.projects?.find(item => item.id === projectId); need(project, '项目不存在');
    return project.assets ??= [];
  };
  let label='';
  switch(kind){
    case 'project.create': {const projectId=createdProjectId(p.id),fields=createdProjectFields(p);need(!w.projects?.some(project=>project.id===projectId),'项目标识已存在');w.projects=[...(w.projects??[]),{id:projectId,...fields,teamId:'carddemo',owner:'owner',createdAt:at,updatedAt:at}];label='添加项目';break;}
    case 'project.metadata.update': {const projectId=createdProjectId(p.id),fields=createdProjectFields(p),project=w.projects?.find(item=>item.id===projectId);need(project,'自建项目不存在');Object.assign(project,fields,{updatedAt:at});label='更新自建项目信息';break;}
    case 'project.update': w.project.name=text(p,'name',80);w.project.description=text(p,'description',1500);w.project.repository=text(p,'repository',200);label='更新项目信息';break;
    case 'asset.link': {
      const assets=writableAssets(),source=sourceAssets.find(asset=>asset.id===p.sourceAssetId);
      need(source,'来源资产不存在'); need((p.projectId??'carddemo')!=='carddemo'||source.sourceProjectId==='carddemo','请选择本项目的来源资产');
      need(!w.connections.some(connection=>connection.id===source.pluginId&&!connection.enabled),'请先启用该来源插件');
      need(assets.length<50,'项目资产数量已达上限'); need(!assets.some(asset=>legacyAssetSourceIds(asset).includes(source.id)),'该来源资产已关联');
      assets.push({id,title:source.title,kind:source.kind,location:source.references.map(reference=>reference.path).join(' · ')||source.sourceRecordId,sourceAssetId:source.id});label='关联插件来源资产';break;
    }
    case 'asset.add': {const assets=writableAssets();need(assets.length<50,'项目资产数量已达上限');assets.push({id,title:text(p,'title',120),kind:text(p,'kind',40),location:text(p,'location',500)});label='关联项目资产';break;}
    case 'material.add': need(!s.context,'上下文已冻结，请在下一次任务中采用新增材料');need(w.materials.length<20,'材料数量已达上限');w.materials.push({id,title:text(p,'title',120),body:text(p,'body',5000)});label='补充需求材料';break;
    case 'skills.select': need(!s.context,'本次上下文已冻结');need(Array.isArray(p.skills)&&p.skills.length>0&&p.skills.length<=availableSkillIds.length&&p.skills.every(x=>typeof x==='string'&&availableSkillIds.includes(x)),'请选择有效的项目或用户 Skill');w.selectedSkills=[...new Set(p.skills as string[])];label='选择需求业务 Skill';break;
    case 'resource.publish': {const resourceId=text(p,'id',120);need(shareableResourceIds.includes(resourceId),'该资源不在可共享范围');const version=resourceVersion(s,resourceId);need(!resourcePublications(s).some(item=>item.id===resourceId&&item.version===version),'该资源版本已发布');w.resourcePublications=[...(w.resourcePublications??[]).filter(item=>item.id!==resourceId),{id:resourceId,version,publishedAt:at,scope:'team',publisher:'owner'}];label='发布共享资源';break;}
    case 'resource.acquire': {const name=text(p,'name',120);need(shareableResourceIds.includes(name)&&resourcePublications(s).some(item=>item.id===name),'请获取已发布的共享资源');need(!w.acquiredResources.includes(name),'该资源已获取');w.acquiredResources.push(name);label='订阅共享资源';break;}
    case 'team.update': w.team.name=text(p,'name',80);label='更新团队信息';break;
    case 'member.invite': {const name=text(p,'name',40);need(!w.team.members.some(m=>m.name===name),'该成员已在团队或邀请列表中');need(w.team.members.length<50,'团队成员数量已达上限');w.team.members.push({id,name,role:'member',status:'invited'});label='创建成员邀请';break;}
    case 'member.approve': {const m=w.team.members.find(m=>m.id===p.id);need(m&&m.status==='invited','邀请记录不存在');m.status='active';label='确认成员加入';break;}
    case 'member.role': {const m=w.team.members.find(m=>m.id===p.id);need(m&&m.status==='active'&&!['owner','member'].includes(m.id),'默认角色不可修改');need(p.role==='owner'||p.role==='member','角色无效');m.role=p.role;label='调整团队角色';break;}
    case 'member.remove': need(typeof p.id==='string'&&!['owner','member'].includes(p.id)&&w.team.members.some(m=>m.id===p.id),'无法移除固定角色或不存在的成员');w.team.members=w.team.members.filter(m=>m.id!==p.id);label='移除团队成员';break;
    case 'progress.sync': need(w.foundation.progressEnabled,'请先启用团队协作进度同步能力');need(s.context&&['developing','failed','fixed','returned'].includes(s.stage),'请先开始 iCode 开发作业');w.progress.push({id,text:text(p,'text',2000),at,node:'develop'});label='iCode 进度同步';break;
    case 'session.report': need(w.foundation.uploadEnabled,'请先启用团队协作会话上报能力');need(['submitted','accepted'].includes(s.stage),'请先提交交付成果');need(!w.sessionReported,'该会话已经关联上报');w.sessionReported=true;w.reportAt=at;label='关联会话与轨迹';break;
    case 'analysis.run': need(w.sessionReported,'请先上报并关联交付会话');need(p.scope==='single'||p.scope==='project','分析范围无效');need(s.evolution==='none','已有改进候选，请保留本次分析依据');w.analysis={scope:p.scope,status:'analyzed'};label=p.scope==='project'?'项目多需求分析':'单需求轨迹分析';break;
    case 'connection.update': {let c=w.connections.find(c=>c.id===p.id);if(!c&&typeof p.id==='string'){const seeded=externalPlatformDefault(p.id);if(seeded){c=w.connections.find(connection=>connection.id===seeded.id);if(!c){c=seeded;w.connections.push(c);}}}need(c,'连接不存在');need(typeof p.enabled==='boolean','启用状态无效');c.enabled=p.enabled;c.description=text(p,'description',1500);label=externalPlatformDefault(c.id)?'更新企业连接配置':'更新能力配置';break;}
    case 'foundation.update': need(typeof p.progressEnabled==='boolean'&&typeof p.uploadEnabled==='boolean','基础能力配置无效');w.foundation={progressEnabled:p.progressEnabled,uploadEnabled:p.uploadEnabled};label='更新基础协作配置';break;
  }
  s.revision++;s.audit.push({id:s.revision,at,role,system:kind==='analysis.run'?'Talent':'Teams',action:label,detail:kind==='progress.sync'?String(p.text):kind==='resource.publish'?String(p.id)+' · '+resourceVersion(s,String(p.id)):kind==='resource.acquire'?String(p.name):label,origin:'simulated'});return s;
}
