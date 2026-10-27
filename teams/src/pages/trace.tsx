import { TaskSessions } from '../components/task-sessions.js';
import { preferredDeliveryTask, projectDeliveryTasks } from '../project-delivery-tasks.js';
import { CollaborationProgress } from '../components/collaboration-progress.js';
import { displayRequirementId } from '../display-text.js';
import { displayText } from '../display-text.js';
import { TeamsPageIntro } from '../components/teams-reuse.js';
import { useState } from 'react';
import { Button, Descriptions, Empty, Space, Tabs, Tag, Timeline } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useDemo } from '../context.js';
import { FrameworkCard } from '../vendor/teams/components/page-layout.js';
import { MiniStat, talentLink } from '../components/common.js';
export function Trace({ initial }: { initial?: string }) {
  const { data, state, showEvidence, role, update, busy } = useDemo();
  const [selected, setSelected] = useState(initial === 'security' ? 'security' : 'E1');
  if(state.workspace.deliveryRequirements?.some(task=>task.id==='DEMO-MKT-001'&&task.projectId==='carddemo')){
    const params=new URLSearchParams(location.hash.split('?')[1]??''),projectId=params.get('project')??'carddemo',requested=params.get('task'),tasks=projectDeliveryTasks(state,projectId,role),task=(requested?tasks.find(item=>item.id===requested):preferredDeliveryTask(tasks,role))?.record;
    if(!task)return <Empty description="当前范围没有可查看的任务执行记录"/>;
    const scope={projectId:task.projectId,taskId:task.id};
    return <div className="page-stack" data-trace-task={task.id}><TeamsPageIntro actions={<Button href={'#/projects?'+new URLSearchParams({project:task.projectId,tab:'delivery',task:task.id})}>返回任务交付</Button>}>{displayRequirementId(task.id)} · {task.title}</TeamsPageIntro><FrameworkCard title="当前任务执行记录"><p>{task.description}</p><Descriptions column={1} items={(['prepare','develop','verify','accept'] as const).map((node,index)=>({key:node,label:['需求澄清','功能开发','测试验证','需求验收'][index],children:task.nodes[node].summary||'尚无执行结果'}))}/></FrameworkCard><TaskSessions scope={scope} readonly/><CollaborationProgress {...scope}/></div>;
  }
  const evidence = data.evidence.find(e => e.id === selected);
  return <div className="page-stack">
    <TeamsPageIntro actions={role === 'owner' ? <Button href={talentLink('sessions')}>分析交付记录 <ArrowRightOutlined /></Button> : <Button href="#/projects?tab=delivery">返回我的交付</Button>}>MKT-001 · 白金卡消费返现</TeamsPageIntro>
    <TaskSessions readonly />
    <div className="metrics-row"><MiniStat label="关联需求" value="1"/><MiniStat label="交付材料" value={data.evidence.length}/><MiniStat label="修复事项" value="1 项"/><MiniStat label="进度记录" value={state.workspace.progress.length}/></div>
    <FrameworkCard title="问题与处理"><div className="two-columns"><div><h3>资格校验 → 修复 → 复测</h3><p>普通卡客户不应获得白金卡专属返现，修复后核对全部规则。</p><Space wrap><Button onClick={()=>showEvidence('E3')}>首次检查</Button><Button onClick={()=>showEvidence('E4')}>修复说明</Button><Button onClick={()=>showEvidence('E5')}>复测结果</Button></Space></div><div><h3>交付边界</h3><p>本次功能验收与生产发布分别管理。安全扫描、正式活动细则和上线审批仍需确认。</p><Tag color="gold">安全验证待完成</Tag></div></div></FrameworkCard>
    <Tabs items={[{ key:'records',label:'交付依据',children:<div className="trace-layout"><FrameworkCard title="材料目录"><div className="evidence-nav">{data.evidence.map(e=><button key={e.id} className={selected===e.id?'selected':''} onClick={()=>setSelected(e.id)}><span>{e.id}</span><strong>{e.title}</strong></button>)}<button onClick={()=>setSelected('security')} className={selected==='security'?'selected':''}><span>安全</span><strong>未完成事项</strong></button></div></FrameworkCard><FrameworkCard title={evidence?.title??'待验证事项'}>{evidence?<pre className="evidence-console">{evidence.body}</pre>:<div>{data.blueprint.gaps.slice(0,2).map(g=><div className="finding" key={g.name}><Tag color="gold">待验证</Tag><h3>{g.name}</h3><p>{g.fact}</p><p>{g.limit}</p></div>)}</div>}</FrameworkCard></div>},{key:'collaboration',label:'协作记录 · '+state.audit.length,children:<FrameworkCard title="Teams 与 Talent 协作"><Timeline items={state.audit.map(a=>({key:a.id,color:a.system==='Talent'?'blue':'purple',title:<Space><strong>{displayText(a.action)}</strong><Tag>{a.system}</Tag><small>{a.role==='owner'?'林悦':'陈晨'}</small></Space>,content:<><p>{displayText(a.detail)}</p><small className="muted">{new Date(a.at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}</small></>}))}/>{!state.audit.length&&<p className="muted">暂无协作记录。</p>}</FrameworkCard>}]} />
  </div>;
}
