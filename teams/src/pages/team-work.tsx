import { TeamsPageIntro } from '../components/teams-reuse.js';
import { Button, Descriptions, Space, Table, Tabs, Tag } from 'antd';
import { useDemo } from '../context.js';
import { FrameworkCard } from '../vendor/teams/components/page-layout.js';
import { Heading, Origin } from '../components/common.js';
import { presence, teamUsage, type DemoMember, type Presence } from '../operations.js';

const colors: Partial<Record<Presence, string>> = { '执行中': 'green', '等待人工处理': 'gold', '在线空闲': 'blue' };
export function MemberUsageTable() {
  const { state, navigate, showText } = useDemo();
  return <Table<DemoMember> size="middle" rowKey="id" pagination={false} dataSource={teamUsage(state)} scroll={{ x: 720 }}
    expandable={{ rowExpandable: row => row.instances.length > 0, expandedRowRender: row => <div className="instance-list">{row.instances.map(instance => <Descriptions key={instance.id} size="small" column={2} items={[
      { key: 'id', label: '执行实例', children: instance.id }, { key: 'state', label: '状态', children: <Tag color={colors[instance.state]}>{instance.state}</Tag> },
      { key: 'task', label: '任务', children: instance.task }, { key: 'project', label: '项目', children: instance.project },
    ]} />)}<p className="muted">本机实例状态可在 Agent 管理中查看。</p></div> }}
    columns={[
      { title: '成员', dataIndex: 'name', width: 82 },
      { title: 'iCode 状态', width: 130, render: (_, row) => <Tag color={colors[presence(row)]}>{presence(row)}</Tag> },
      { title: '当前任务 / 项目', render: (_, row) => <div className="member-task"><strong>{row.instances[0]?.task ?? '尚未使用 iCode'}</strong><small>{row.instances[0]?.project ?? '—'}</small></div> },
      { title: '最近活跃', dataIndex: 'lastActive', width: 110 },
      { title: '今日 Token', width: 108, render: (_, row) => row.tokens.toLocaleString('zh-CN') },
      { title: '作业', width: 100, render: (_, row) => <Button type="link" size="small" disabled={!row.used} onClick={() => row.id === 'chen' ? navigate('trace') : showText(row.name + ' · 作业', row.instances.map(i => `${i.id} · ${i.state}\n${i.project} / ${i.task}`).join('\n\n') + '\n\n消费返现任务可查看完整交付记录。')}>查看详情</Button> },
    ]} />;
}
export function TeamWork() {
  const { navigate,state,data } = useDemo();
  return <div className="page-stack"><TeamsPageIntro actions={<Origin kind="simulated" />}>从成员作业查看需求、会话与交付证据。</TeamsPageIntro>
    <Tabs items={[{key:'running',label:'运行作业',children:<FrameworkCard title="成员与执行实例"><MemberUsageTable /></FrameworkCard>},{key:'sessions',label:'会话记录',children:<FrameworkCard title="项目关联会话"><Table pagination={false} rowKey="id" dataSource={[{id:data.blueprint.trace.session_id,title:'消费返现 · 开发与修复',member:'陈晨',project:state.workspace.project.name}]} columns={[{title:'会话 / 需求',render:(_,r)=><><strong>{r.title}</strong><p className="muted">MKT-001</p></>},{title:'成员',dataIndex:'member'},{title:'关联状态',render:()=> <Tag color={state.workspace.sessionReported?'green':'gold'}>{state.workspace.sessionReported?'已关联上报':'待上报'}</Tag>},{title:'详情',render:()=> <Button type="link" onClick={()=>navigate('trace')}>查看基础分析</Button>}]}/></FrameworkCard>}]} />
    <FrameworkCard title="消费返现 · 完整交付链路"><Space wrap><Tag>陈晨 · 项目成员</Tag><Tag>MKT-001</Tag><Origin kind="simulated" /></Space><p>查看冻结上下文、关联作业、资格规则修复、检查复测，以及当前提交和验收记录。</p><Button type="primary" onClick={() => navigate('trace')}>查看消费返现追溯</Button></FrameworkCard>
  </div>;
}
