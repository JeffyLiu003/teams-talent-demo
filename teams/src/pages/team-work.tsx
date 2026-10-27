import { displayText, displayRequirementId } from '../display-text.js';
import { useMemo, useState } from 'react';
import { Button, Descriptions, Drawer, Empty, Select, Space, Table, Tabs, Tag } from 'antd';
import { TeamsPageIntro } from '../components/teams-reuse.js';
import { useDemo } from '../context.js';
import { FrameworkCard } from '../vendor/teams/components/page-layout.js';
import { presence, teamUsage, type DemoMember, type Presence } from '../operations.js';
import { teamWorkIndex, type TeamWorkEntry } from '../project-overview.js';
import { RequirementDetail, requirementPhaseLabel } from '../components/requirement-detail.js';
import { TaskSessions } from '../components/task-sessions.js';
import { CollaborationProgress } from '../components/collaboration-progress.js';
import type { CollectedSession } from '../task-automation.js';
import '../operations.css';

const colors: Partial<Record<Presence, string>> = { '执行中': 'green', '等待人工处理': 'gold', '在线空闲': 'blue' };
const activityLabels = { started: '已开始', progress: '进度回传', blocked: '报告阻塞', result: '成果待确认' } as const;
const knowledgeLabels = { running: '正在导入', ready: '输入已就绪', waiting: '等待输入就绪', failed: '导入未完成' } as const;
const collectionLabels = { queued: '等待归集', running: '正在归集', collected: '已归集', empty: '暂无会话', failed: '归集未完成' } as const;

export function MemberUsageTable() {
  const { state } = useDemo();
  return <Table<DemoMember> size="middle" rowKey="id" pagination={false} dataSource={teamUsage(state)} scroll={{ x: 720 }}
    expandable={{ rowExpandable: row => row.instances.length > 0, expandedRowRender: row => <div className="instance-list">{row.instances.map(instance => <Descriptions key={instance.id} size="small" column={2} items={[
      { key: 'id', label: '执行实例', children: instance.id }, { key: 'state', label: '状态', children: <Tag color={colors[instance.state]}>{instance.state}</Tag> },
      { key: 'task', label: '任务', children: instance.task }, { key: 'project', label: '项目', children: instance.project },
    ]} />)}</div> }}
    columns={[
      { title: '成员', dataIndex: 'name', width: 100 },
      { title: '运行状态', width: 140, render: (_, row) => <Tag color={colors[presence(row)]}>{presence(row)}</Tag> },
      { title: '当前任务 / 项目', render: (_, row) => <div className="member-task"><strong>{row.instances[0]?.task ?? '尚未使用 iCode'}</strong><small>{row.instances[0]?.project ?? '—'}</small></div> },
      { title: '最近活跃', dataIndex: 'lastActive', width: 130 },
    ]} />;
}

function SourceTags({ entry }: { entry: TeamWorkEntry }) {
  return <Space wrap><Tag color={entry.projectId === 'teams' ? 'blue' : 'purple'}>{entry.projectId === 'teams' ? '导入快照' : entry.item.source.origin === 'teams-task' ? 'Teams 任务' : '当前工作流'}</Tag>{entry.item.activity && <Tag color="green">本机回传</Tag>}{entry.item.source.requirement?.category === 'research' && <Tag>调研</Tag>}</Space>;
}

export function TeamWork() {
  const { navigate, state, data } = useDemo();
  const [project, setProject] = useState('all'), [owner, setOwner] = useState('all'), [phase, setPhase] = useState('all');
  const [selected, setSelected] = useState<TeamWorkEntry | null>(null);
  const entries = useMemo(() => teamWorkIndex(state, data), [state, data]);
  const projects = [...new Map(entries.map(entry => [entry.projectId, entry.projectName])).entries()];
  const owners = [...new Set(entries.map(entry => entry.item.owner))];
  const visible = entries.filter(entry => (project === 'all' || entry.projectId === project) && (owner === 'all' || entry.item.owner === owner) && (phase === 'all' || entry.item.phase === phase));
  const selectedEntry = selected ? entries.find(entry => entry.id === selected.id) ?? selected : null;
  const sessionRows = visible.flatMap(entry => entry.sessions.map(session => ({ ...session, id: entry.id + ':' + session.tool + ':' + session.sessionId, entry })));
  const filters = <div className="team-work-filters"><Space wrap><Select aria-label="筛选追溯项目" value={project} onChange={setProject} options={[{ value: 'all', label: '全部项目' }, ...projects.map(([value, label]) => ({ value, label }))]} /><Select aria-label="筛选交付人" value={owner} onChange={setOwner} options={[{ value: 'all', label: '全部交付人' }, ...owners.map(value => ({ value, label: value }))]} /><Select aria-label="筛选交付阶段" value={phase} onChange={setPhase} options={[{ value: 'all', label: '全部阶段' }, ...(['待开展', '准备', '开发', '验证', '待验收', '已交付'] as const).map(value => ({ value, label: requirementPhaseLabel(value) }))]} /></Space><span>{visible.length} / {entries.length} 项任务</span></div>;
  return <div className="page-stack team-work-page"><TeamsPageIntro actions={<Tag>{entries.length} 项任务</Tag>}>跨项目查看任务交付、会话和本机回传；导入快照与运营样例分别标识。</TeamsPageIntro>
    <Tabs defaultActiveKey="tasks" items={[
      { key: 'tasks', label: '任务作业', children: <>{filters}<FrameworkCard title="跨任务作业索引"><Table<TeamWorkEntry> rowKey="id" size="middle" pagination={false} scroll={{ x: 1120 }} dataSource={visible} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前筛选没有任务作业" /> }} columns={[
        { title: '项目 / 需求', width: 270, render: (_, entry) => <div className="team-work-cell"><strong>{entry.projectName}</strong><span>{displayText(entry.item.source.title)}</span><small>{displayRequirementId(entry.scope.taskId)}</small></div> },
        { title: '交付人', width: 105, dataIndex: ['item', 'owner'] },
        { title: '交付阶段', width: 115, render: (_, entry) => <Tag color={entry.item.phase === '已交付' ? 'green' : entry.item.phase === '待验收' ? 'gold' : undefined}>{requirementPhaseLabel(entry.item.phase)}</Tag> },
        { title: '最近回传', render: (_, entry) => <div className="team-work-cell"><span>{entry.item.activity ? activityLabels[entry.item.activity.phase] : '未回传'}</span><small>{entry.item.activity ? displayText(entry.item.activity.summary) : '尚无此任务的本机回传'}</small></div> },
        { title: '会话 / 自动化', width: 175, render: (_, entry) => <div className="team-work-cell"><span>{entry.sessions.length} 个会话</span><small>{entry.automation?.collection ? collectionLabels[entry.automation.collection.status] : entry.automation?.knowledge ? '知识导入 · ' + knowledgeLabels[entry.automation.knowledge.status] : '未触发自动归集'}</small></div> },
        { title: '来源', width: 155, render: (_, entry) => <SourceTags entry={entry} /> },
        { title: '操作', width: 95, render: (_, entry) => <Button type="link" size="small" onClick={() => setSelected(entry)}>查看详情</Button> },
      ]} /></FrameworkCard></> },
      { key: 'sessions', label: '会话记录', children: <>{filters}<FrameworkCard title="任务关联会话"><Table<(CollectedSession & { id: string; entry: TeamWorkEntry })> rowKey="id" size="middle" pagination={false} scroll={{ x: 1050 }} dataSource={sessionRows} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前筛选没有任务会话" /> }} columns={[
        { title: '项目 / 需求', width: 260, render: (_, row) => <div className="team-work-cell"><strong>{row.entry.projectName}</strong><span>{displayText(row.entry.item.source.title)}</span><small>{displayRequirementId(row.entry.scope.taskId)}</small></div> },
        { title: '工具 / 会话', width: 250, render: (_, row) => <div className="team-work-cell"><strong>{row.tool}</strong><small>{row.sessionId}</small></div> },
        { title: '节点 / 来源', render: (_, row) => <div className="team-work-cell"><span>{row.nodeIds.join(' / ')}</span><small>{row.sources.join('、')}</small></div> },
        { title: '时间范围', width: 190, render: (_, row) => <div className="team-work-cell"><span>{new Date(row.firstAt).toLocaleString('zh-CN', { hour12: false })}</span><small>至 {new Date(row.lastAt).toLocaleString('zh-CN', { hour12: false })}</small></div> },
        { title: '操作', width: 100, render: (_, row) => <Button type="link" size="small" onClick={() => setSelected(row.entry)}>查看任务</Button> },
      ]} /></FrameworkCard></> },
      { key: 'members', label: '成员运行概览', children: <FrameworkCard title="成员与执行实例" action={<Tag>运营样例</Tag>}><MemberUsageTable /><p className="muted">展开成员行可查看实例。此处不用于跨成员实时状态或交付追溯；本机实际状态请在 Agent 管理中核验。</p></FrameworkCard> },
    ]} />
    <Drawer title={selectedEntry?.item.source.title ?? '任务详情'} width={820} open={!!selectedEntry} onClose={() => setSelected(null)} destroyOnHidden>{selectedEntry && <div className="page-stack"><SourceTags entry={selectedEntry} /><RequirementDetail projectId={selectedEntry.projectId} item={selectedEntry.item} />{selectedEntry.projectId !== 'teams' && <>
      {selectedEntry.automation && <FrameworkCard title="自动化与 Talent 回执"><Descriptions column={1} size="small" items={[{ key: 'knowledge', label: '知识导入', children: selectedEntry.automation.knowledge ? knowledgeLabels[selectedEntry.automation.knowledge.status] : '未触发' }, { key: 'collection', label: '验收后归集', children: selectedEntry.automation.collection ? collectionLabels[selectedEntry.automation.collection.status] : '未触发' }, { key: 'reporting', label: 'Talent 接收', children: selectedEntry.automation.collection?.reporting?.status === 'reported' ? '已接收 · ' + selectedEntry.automation.collection.reporting.receipt?.id : selectedEntry.automation.collection?.reporting?.reason ?? '尚未上报' }]} /></FrameworkCard>}
      <TaskSessions readonly scope={selectedEntry.scope} /><CollaborationProgress projectId={selectedEntry.scope.projectId} taskId={selectedEntry.scope.taskId} />
    </>}{selectedEntry.scope.projectId === 'carddemo' && selectedEntry.scope.taskId === 'DEMO-MKT-001' && <Button onClick={() => navigate('trace')}>打开主任务交付记录</Button>}</div>}</Drawer>
  </div>;
}
