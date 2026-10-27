import { TaskDeliveryFlow } from '../components/task-delivery-flow.js';
import { ProjectTaskManagement } from '../components/project-task-management.js';
import { displayText } from '../display-text.js';
import { useState } from 'react';
import { Alert, Button, Descriptions, Drawer, Input, Select, Space, Table, Tabs, Tag } from 'antd';
import { ArrowRightOutlined, CodeOutlined, FileTextOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { useDemo } from '../context.js';
import { FrameworkCard } from '../vendor/teams/components/page-layout.js';
import { Mono } from '../components/common.js';
import { ProjectToolbar, projectPages as tabs } from '../components/project-toolbar.js';
import { ProjectContentTemplate } from '../components/project-content-template.js';
import { ProjectAssets } from '../components/project-assets.js';
import { ProjectKnowledge } from '../components/project-knowledge.js';
import type { Presentation } from '../api.js';
import { CollaborationProgress } from '../components/collaboration-progress.js';
import { ProjectWorkLaunch } from '../components/project-work-launch.js';
import '../teams-project.css';

type Snapshot = Presentation['teamsProject'];
type Task = Snapshot['tasks'][number];
const sourceTag = <Tag color="blue">Teams 项目记录</Tag>;
const teamRoute = (tab:string, extra:Record<string,string>={}) => 'projects?'+new URLSearchParams({project:'teams',tab,...extra}).toString();
const memberName = (id:string) => id==='U'?'待分配':'成员 '+id;

export function TeamsProjectCard() {
  const {data,role,navigate}=useDemo(),s=data.teamsProject,p=s.project;
  return <FrameworkCard title={p.name} action={sourceTag}><p>{displayText(p.description)}</p><Descriptions size="small" column={2} items={[{key:'team',label:'所属团队',children:'Teams 开发团队'},{key:'owner',label:'项目 Owner',children:memberName(p.owner)},{key:'repo',label:'主仓',children:p.repos[0].name},{key:'scope',label:'项目数据',children:s.tasks.length+' 个任务 · '+s.releases.length+' 个版本'}]} /><Space wrap><Button type="primary" data-project-primary="teams" aria-label={(role==='owner'?'进入任务管理：':'进入任务交付：')+p.name} onClick={()=>navigate(teamRoute(role==='owner'?'management':'delivery'))}>{role==='owner'?'进入任务管理':'进入任务交付'}</Button><Button onClick={()=>navigate(teamRoute('content'))}>项目资料</Button>{role==='owner'&&<Button onClick={()=>navigate(teamRoute('delivery'))}>交付与验收</Button>}</Space></FrameworkCard>;
}

export function TeamsProject({params}:{params:URLSearchParams}) {
  const {data,navigate,showText}=useDemo(),s=data.teamsProject,p=s.project;
  const tab=params.get('tab')??'content';
  const [sessions,setSessions]=useState(false);
  const document=(path:string)=>{const doc=s.documents.find(d=>d.path===path);showText(path,doc?.content??'本次导入未包含该文件。');};
  const jump=(tab:string,extra:Record<string,string>={})=>navigate(teamRoute(tab,extra));
  if(!tabs.some(t=>t.key===tab))return <Alert type="error" title="iCode Teams 项目页面不存在" action={<Button onClick={()=>jump('content')}>进入项目概览</Button>}/>;
  return <div className="page-stack teams-imported-project project-detail">
    <ProjectToolbar activeKey={tab} onChange={value=>jump(value)} actions={<>
      {sourceTag}
      <Button type="text" icon={<FileTextOutlined/>} aria-label="数据来源" title="数据来源" onClick={()=>showText('导入来源与文件清单','原 Teams 项目数据\n保留原项目的成员 A / B / C、任务与版本关系。当前浏览项目导入记录。\n\n'+JSON.stringify({commit:s.sourceCommit,importedAt:s.importedAt,files:s.sourceFiles},null,2))}><span className="project-secondary-action-label">数据来源</span></Button>
      <Button type="text" onClick={()=>setSessions(true)}>iCode 作业记录</Button>
      <ProjectWorkLaunch target={{projectId:'teams',tab,...(params.get('task')?{taskId:params.get('task')!}:{}),...(params.get('node')?{nodeId:params.get('node')!}:{}),...(params.get('discussion')?{discussionId:params.get('discussion')!}:{}),...(params.get('release')?{releaseId:params.get('release')!}:{})}} />
    </>}/>
    {tab==='content'?<ProjectContentTemplate projectId="teams" name={p.name} description={displayText(p.description)} origin={sourceTag}
      information={[{key:'team',label:'所属团队',children:'Teams 开发团队'},{key:'owner',label:'项目 Owner',children:memberName(p.owner)},
        {key:'repository',label:'主仓',span:2,children:<>{p.repos.map(repo=><div key={repo.name}><strong>{repo.name}</strong> <Tag>{repo.branch}</Tag><Mono>{repo.path}</Mono><p className="muted">{displayText(repo.note)}</p></div>)}</>},
        {key:'directory',label:'本机目录',span:2,children:'导入快照未核验本机工作目录 · '+p.repoNote},
        {key:'scope',label:'项目数据',span:2,children:`${s.tasks.length} 个任务 · ${s.inputs.length} 条输入 · ${s.discussions.length} 条讨论 · ${s.releases.length} 个版本`},
      ]}
      members={<><Table size="small" pagination={false} rowKey="id" dataSource={s.members} columns={[{title:'成员',dataIndex:'name'},{title:'职责',dataIndex:'role'}]}/><p className="muted">成员 A、B、C 为项目协作成员。{displayText(p.phase)}</p></>}
      assets={<ProjectAssets projectId="teams" extra={<><p>{displayText(p.agentsNote)}</p><Button onClick={()=>document('AGENTS.md')}>查看 AGENTS.md</Button></>} />}
      knowledge={<ProjectKnowledge projectId="teams" />}
      requirements={<><div className="talent-rule-grid">{p.sources.map(source=><div key={source.name}><h3>{source.name}</h3><p>{displayText(source.description)}</p><Tag>{source.status}</Tag></div>)}</div><p className="muted">{displayText(p.runtime)}</p><Button onClick={()=>jump('management')}>进入任务管理 <ArrowRightOutlined/></Button></>}
      skills={p.skills.map(skill=>{const path='.agents/skills/'+skill.name+'/SKILL.md';return {...skill,version:'源码快照 '+s.sourceCommit.slice(0,7),source:'原 Teams 仓库快照',path,content:s.documents.find(doc=>doc.path===path)?.content};})}
      skillFooter={<div className="project-skill-context"><p>本项目保留原任务流程，任务输入与节点记录可在交付页面查看。</p><Button onClick={()=>jump('delivery',{task:s.selection.taskId,node:s.tasks.find(task=>task.id===s.selection.taskId)!.nodes[0].id})}>查看任务准备与输入</Button></div>}
    />:tab==='management'?<ProjectTaskManagement projectId="teams"/>:tab==='delivery'?<ImportedDelivery snapshot={s} params={params} jump={jump}/>:null}
    <Drawer title="iCode Teams · 项目作业记录" open={sessions} onClose={()=>setSessions(false)} width={650}><div className="page-stack"><Alert type="info" title="项目作业上下文" description="以下内容来自 Teams 预置会话快照，关联需求讨论、交付节点和版本观察。"/>{s.sessions.map(session=><FrameworkCard key={session.key} title={displayText(session.title)} action={<Tag>{displayText(session.status)}</Tag>}><p>{displayText(session.location)} · {memberName(session.owner)}</p><h3>{displayText(session.resultTitle)}</h3><p>{displayText(session.resultText)}</p>{session.target.page!=='release'&&<Button onClick={()=>{setSessions(false);const target=session.target;jump(target.page,{...(target.item?{discussion:target.item}:{}),...(target.task?{task:target.task}:{}),...(target.node?{node:target.node}:{}),...(target.version?{release:target.version}:{})});}}>查看关联事项</Button>}<Button type="link" onClick={()=>showText(session.short+' · 作业上下文',JSON.stringify(session,null,2))}>查看完整上下文</Button></FrameworkCard>)}</div></Drawer>
  </div>;
}

function ImportedDelivery({snapshot:s,params,jump}:{snapshot:Snapshot;params:URLSearchParams;jump:(tab:string,extra?:Record<string,string>)=>void}) {
  const {showText}=useDemo();
  const task=s.tasks.find(t=>t.id===(params.get('task')??s.selection.taskId));
  if(!task)return <Alert type="error" title="任务未包含在导入快照中" action={<Button onClick={()=>jump('management')}>查看任务清单</Button>}/>;
  const nodeId=params.get('node')??(task.id===s.selection.taskId?s.selection.nodeId:task.nodes[0].id);
  const selected=task.nodes.find(n=>n.id===nodeId);
  if(!selected)return <Alert type="error" title="交付节点不存在" action={<Button onClick={()=>jump('delivery',{task:task.id})}>返回任务</Button>}/>;
  const select=(node:string)=>jump('delivery',{task:task.id,node});
  const primary=task.nodes.filter(n=>n.id!=='prep'),parallel=task.nodes.find(n=>n.id==='prep');
  const nodeButton=(n:NonNullable<typeof selected>)=><button key={n.id} className={'imported-node'+(selected.id===n.id?' selected':'')} aria-label={'Teams 节点：'+n.name} aria-current={selected.id===n.id?'step':undefined} onClick={()=>select(n.id)}><strong>{n.name}</strong><small>{n.status}</small><span>{n.owner}</span></button>;
  return <div className="imported-delivery">
    <aside className="imported-task-list"><h3>交付任务 <Tag>{s.tasks.length}</Tag></h3>{s.tasks.map(t=><button key={t.id} className={t.id===task.id?'active':''} aria-label={t.id+' · '+t.title} onClick={()=>jump('delivery',{task:t.id})}><small>{t.id}</small><strong>{t.title}</strong><Tag>{t.status}</Tag></button>)}</aside>
    <main className="page-stack imported-node-main"><div><h2>{task.title}</h2><p className="muted">{task.id} · {task.version} 版本 · {memberName(task.owner)}</p></div>
      <TaskDeliveryFlow scope={{projectId:'teams',taskId:task.id}} readonly showAutomation={task.type!=='调研' && task.nodes.some(node=>node.id==='accept')} selected={selected.id} onSelect={select} ariaPrefix="Teams 节点：" nodes={primary.map(node=>({id:node.id,label:node.name,role:node.owner,description:node.brief.length>20?node.brief.slice(0,20)+'…':node.brief,status:node.status,complete:node.status==='已完成'}))}/>
      {parallel&&<div className="imported-parallel"><span>需求澄清后并行</span><ArrowRightOutlined/>{nodeButton(parallel)}<ArrowRightOutlined/><span>与开发实现汇合，进入测试验证</span></div>}
      {parallel&&<p className="muted">设计评审可退回方案设计；测试准备与设计、实现并行。流程关系沿用原项目。</p>}
      <FrameworkCard title={selected.name} action={<Tag>{selected.status}</Tag>}><Descriptions size="small" column={1} items={[{key:'owner',label:'节点责任人',children:selected.owner},{key:'brief',label:'当前进展',children:displayText(selected.brief)},{key:'output',label:'已有成果',children:displayText(selected.output)} ]}/><Button onClick={()=>showText(task.id+' / '+selected.name+' · 原节点数据',JSON.stringify(selected,null,2))}>查看节点记录</Button></FrameworkCard>
      <CollaborationProgress projectId="teams" taskId={task.id} /><FrameworkCard title="任务目标与交付标准"><p>{displayText(task.goal)}</p><p><strong>范围：</strong>{displayText(task.scope)}</p><ul>{task.criteria.map(c=><li key={c}>{c}</li>)}</ul><p className="muted">来源：{displayText(task.origin)}</p></FrameworkCard>
    </main>
  </div>;
}
