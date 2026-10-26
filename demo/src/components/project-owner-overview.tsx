import { displayText, displayRequirementId } from '../display-text.js';
import '../project-overview.css';
import { useState, type ReactNode } from 'react';
import { Button, Collapse, Descriptions, Drawer, Empty, Space, Table, Tabs, Tag } from 'antd';
import { useDemo } from '../context.js';
import { filterIssues, filterRequirements, projectOverview, type OverviewFilter, type OverviewIssue, type OverviewRequirement } from '../project-overview.js';
import { FrameworkCard } from '../vendor/teams/components/page-layout.js';
import { ProjectKnowledge } from './project-knowledge.js';
import type { CollaborationEvent } from '../collaboration.js';
import { userSkillsFor } from './project-skills.js';

const metricGroups: { tab: 'requirements' | 'issues'; title: string; note: string; metrics: { key: OverviewFilter; label: string }[] }[] = [
  { tab: 'requirements', title: '需求概览', note: '总数由四个互斥阶段组成；进行中包含准备、开发与验证。', metrics: [
    { key: 'all', label: '需求总数' }, { key: 'pending', label: '待开展' }, { key: 'active', label: '进行中' },
    { key: 'acceptance', label: '待验收' }, { key: 'delivered', label: '已交付' },
  ] },
  { tab: 'issues', title: '问题概览', note: '总数＝未关闭＋已关闭＋待确认；阻塞交付是未关闭问题的子集。', metrics: [
    { key: 'issues', label: '问题总数' }, { key: 'open', label: '未关闭' }, { key: 'closed', label: '已关闭' },
    { key: 'unconfirmed', label: '待确认' }, { key: 'blocking', label: '阻塞交付' },
  ] },
];
const reportLabels = { started: '已开始', progress: '进度回传', blocked: '报告阻塞', result: '结果待确认' };
function Report({ event }: { event: CollaborationEvent }) { return <div className="overview-report"><Tag color={event.phase === 'blocked' ? 'gold' : undefined}>{reportLabels[event.phase]}</Tag><span>{event.summary}</span>{event.nodeId && <small>节点 {event.nodeId}</small>}</div>; }
function Quality({ item }: { item: OverviewRequirement }) { return <div className="overview-quality">{item.quality.map(result => <span key={result.label}><span className="muted">{result.label}</span><Tag color={result.passed ? 'green' : undefined}>{result.result}</Tag></span>)}</div>; }

export function OwnerProjectOverview({ projectId, resources, skillContent, skillCount, origin }: { projectId: string; resources: ReactNode; skillContent: ReactNode; skillCount: number; origin?: ReactNode }) {
  const { state, data, role, navigate, showText } = useDemo();
  const model = projectOverview(state, data, projectId);
  const [tab, setTab] = useState<'requirements' | 'issues'>('requirements');
  const [requirementFilter, setRequirementFilter] = useState<OverviewFilter>('all'), [issueFilter, setIssueFilter] = useState<OverviewFilter>('issues');
  const filter = tab === 'requirements' ? requirementFilter : issueFilter;
  const defaultFilter = tab === 'requirements' ? 'all' : 'issues';
  const resetFilter = () => tab === 'requirements' ? setRequirementFilter('all') : setIssueFilter('issues');
  const selectTab = (value: string) => {
    if (value === 'requirements') { setTab('requirements'); setRequirementFilter('all'); }
    else if (value === 'issues') { setTab('issues'); setIssueFilter('issues'); }
  };
  const [panel, setPanel] = useState<'resources' | 'skills' | null>(null), [selection, setDetail] = useState<OverviewRequirement | OverviewIssue | null>(null);
  const detail = selection ? [...model.requirements, ...model.research, ...model.issues].find(item => item.id === selection.id) ?? null : null;
  const requirements = filterRequirements(model, requirementFilter), issues = filterIssues(model, issueFilter);
  const visibleCount = tab === 'requirements' ? requirements.length : issues.length;
  const totalCount = tab === 'requirements' ? model.counts.all : model.counts.issues;
  const filterLabel = metricGroups.find(group => group.tab === tab)?.metrics.find(metric => metric.key === filter)?.label;
  const unknownIssues = model.counts.unconfirmed;
  const jump = (item: OverviewRequirement) => item.route ? navigate(item.route) : setDetail(item);
  const todos = [
    ...model.requirements.filter(item => item.pendingConfirmation).map(item => ({ id: item.id, label: '待确认需求', title: item.source.title, act: () => jump(item) })),
    ...model.requirements.filter(item => item.phase === '待验收').map(item => ({ id: item.id, label: '待验收成果', title: item.source.title, act: () => jump(item) })),
    ...[...model.requirements, ...model.research].filter(item => item.activity?.phase === 'blocked').map(item => ({ id: 'report-' + item.id, label: '作业待协调', title: item.source.title, act: () => setDetail(item) })),
    ...(model.projectActivity?.phase === 'blocked' ? [{ id: 'project-report', label: '项目作业待协调', title: model.projectActivity.summary, act: () => showText('项目作业阻塞', JSON.stringify(model.projectActivity, null, 2)) }] : []),
    ...model.issues.filter(item => item.blocksDelivery).map(item => ({ id: item.id, label: '需协调阻塞', title: item.source.title, act: () => setDetail(item) })),
    ...(projectId === 'teams' ? data.teamsProject.discussions.filter(item => item.owner === 'A' && ['review', 'waiting'].includes(item.status)).map(item => ({ id: item.id, label: '待确认讨论标准', title: item.title, act: () => navigate('projects?' + new URLSearchParams({ project: projectId, tab: 'management', discussion: item.id })) })) : []),
  ];
  const empty = <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={filter === defaultFilter ? tab === 'requirements' ? '尚无项目需求' : '尚无项目问题' : '当前筛选没有记录'} />;
  return <div className="page-stack project-owner-overview" data-owner-project={projectId}>
    <div className="overview-header"><span><strong>交付概览</strong>{origin}</span><Button onClick={() => setPanel('resources')}>项目资料</Button></div>
    <div className="overview-metric-groups" aria-label="项目交付指标">{metricGroups.map(group => <section key={group.tab} className="overview-metric-group" data-overview-group={group.tab} aria-label={group.title}>
      <div className="overview-metric-heading"><h3>{group.title}</h3><span>{group.note}</span></div>
      <div className="overview-metrics">{group.metrics.map(metric => <Button key={metric.key} data-metric={metric.key} aria-label={metric.label} aria-pressed={filter === metric.key && tab === group.tab} onClick={() => { setTab(group.tab); if (group.tab === 'requirements') setRequirementFilter(metric.key); else setIssueFilter(metric.key); }}><span>{metric.label}</span><strong>{model.counts[metric.key]}</strong></Button>)}</div>
    </section>)}</div>
    <div className="overview-scope"><span>{displayText(model.scope)}</span>{unknownIssues > 0 && <span>{unknownIssues} 项问题关闭状态待确认，单独计数，不纳入未关闭或已关闭数量。</span>}</div>
    <div className="overview-todos" aria-label="Owner 待我处理"><strong>待我处理 <Tag>{todos.length}</Tag></strong>{todos.length ? todos.map(item => <Button key={item.id} size="small" onClick={item.act} aria-label={item.label + '：' + item.title}><span className="muted">{item.label}</span> · {item.title}</Button>) : <span className="muted">暂无待确认或待协调事项</span>}</div>
    <div className="overview-preparation"><ProjectKnowledge projectId={projectId} compact /><div className="overview-skill-summary"><strong>可用 Skill</strong><span>{skillCount} 项项目 Skill · {userSkillsFor(state, data, role).length} 项用户 Skill</span><Button size="small" onClick={() => setPanel('skills')}>查看 Skill</Button></div></div>
    {model.projectActivity && <div className="overview-project-report"><span className="muted">最近项目级回传</span><Report event={model.projectActivity} /></div>}
    <FrameworkCard title="项目交付" action={<Space wrap><span className="muted" data-overview-list-summary data-list-count={visibleCount} data-list-total={totalCount}>{filterLabel} · {visibleCount} / {totalCount} 项{tab === 'requirements' ? '需求' : '问题'}</span>{filter !== defaultFilter && <Button size="small" onClick={resetFilter}>清除筛选</Button>}</Space>}>
      <Tabs activeKey={tab} onChange={selectTab} items={[{ key: 'requirements', label: `需求 · ${model.counts.all}` }, { key: 'issues', label: `问题 · ${model.counts.issues}` }]} />
      {tab === 'requirements' ? <Table<OverviewRequirement> className="overview-requirements" rowKey="id" size="small" pagination={false} scroll={{ x: 1040 }} dataSource={requirements} locale={{ emptyText: empty }} columns={[
        { title: '需求', width: 240, render: (_, item) => <><Button type="link" className="overview-title" onClick={() => setDetail(item)}>{item.source.title}</Button><small className="muted">{displayRequirementId(item.taskId ?? item.source.sourceRecordId)} · {displayText(item.scope)}</small>{item.activity && <Report event={item.activity} />}</> },
        { title: '负责人', width: 80, dataIndex: 'owner' },
        { title: '阶段', width: 120, render: (_, item) => <><Tag color={item.phase === '已交付' ? 'green' : item.phase === '待验收' ? 'gold' : undefined}>{item.phase}</Tag>{item.activity?.phase === 'blocked' && <Tag color="gold">作业报告阻塞</Tag>}{item.issues.some(issue => issue.blocksDelivery) && <Tag color="red">阻塞</Tag>}{state.stage === 'returned' && projectId === 'carddemo' && item.taskId === 'DEMO-MKT-001' && <Tag color="gold">已退回 · 待复验</Tag>}</> },
        { title: '计划完成', width: 110, render: (_, item) => <>{item.due ?? '未排期'}{item.overdue && <small className="overview-overdue">延期{projectId === 'teams' ? '（快照）' : ''}</small>}</> },
        { title: '关联问题', width: 110, render: (_, item) => item.issues.length ? <Button type="link" size="small" onClick={() => setDetail(item)}>{item.issues.filter(issue => issue.closed === false).length} 未关闭{item.issues.some(issue => issue.closed === null) ? ' · 待核对' : ''}</Button> : <span className="muted">无未解决记录</span> },
        { title: '交付结论', width: 280, render: (_, item) => <Quality item={item} /> },
        { title: '操作', width: 100, render: (_, item) => <Button size="small" onClick={() => jump(item)}>{item.route ? item.pendingConfirmation ? '确认需求' : '查看交付' : '查看来源'}</Button> },
      ]} /> : <Table<OverviewIssue> className="overview-issues" rowKey="id" size="small" pagination={false} scroll={{ x: 900 }} dataSource={issues} locale={{ emptyText: empty }} columns={[
        { title: '问题', width: 240, render: (_, item) => <><Button type="link" className="overview-title" onClick={() => setDetail(item)}>{item.source.title}</Button><small className="muted">{item.source.sourceRecordId}</small></> },
        { title: '严重程度', width: 90, dataIndex: 'severity' }, { title: '状态', width: 155, render: (_, item) => <Tag color={item.blocksDelivery ? 'red' : item.closed === true ? 'green' : undefined}>{item.status}</Tag> },
        { title: '负责人（来源）', width: 110, dataIndex: 'owner' },
        { title: '关联与阻塞', width: 150, render: (_, item) => <><span>{item.relatedIds.map(id => model.requirements.find(requirement => requirement.id === id)?.source.title ?? '来源需求尚未纳入交付').join('、')}</span>{item.blocksDelivery && <Tag color="red">阻塞交付</Tag>}</> },
        { title: '处理进展', dataIndex: 'progress' },
      ]} />}
      {!model.requirements.length && !model.issues.length && <Button type="primary" onClick={() => setPanel('resources')}>关联项目数据</Button>}
      {!!model.research.length && <div className="overview-research"><span className="muted">另有 {model.research.length} 项调研，单独保留交付入口：</span>{model.research.map(item => <Button size="small" key={item.id} onClick={() => jump(item)}>{item.taskId} · {item.source.title} · {item.phase}</Button>)}</div>}
      {model.requirements.some(item => item.due) && <p className="muted">计划日期按 {model.asOf} 判断；导入节点完成记录不代表已有真实测试或安全报告。</p>}
    </FrameworkCard>

    <Drawer className="owner-project-panel" title={panel === 'skills' ? '项目可用 Skill' : '项目资料'} width={940} open={!!panel} onClose={() => setPanel(null)} destroyOnHidden><div className="page-stack project-detail">{panel === 'skills' ? skillContent : resources}</div></Drawer>
    <Drawer title={detail?.source.title ?? '项目事项'} width={740} open={!!detail} onClose={() => setDetail(null)} destroyOnHidden>{detail && <div className="page-stack">
      <Tag>来源插件 · {detail.source.sourceRecordId}</Tag><p>{displayText(detail.source.summary)}</p>
      {'phase' in detail ? <><Descriptions column={1} size="small" items={[{ key: 'owner', label: '负责人', children: detail.owner }, { key: 'phase', label: '交付阶段', children: detail.phase + ' · ' + displayText(detail.scope) }, { key: 'due', label: '计划完成', children: detail.due ?? '未排期' }]} /><Quality item={detail} />{detail.activity && <><Report event={detail.activity} />{detail.activity.blocker && <p>阻塞原因：{detail.activity.blocker}</p>}<p className="muted">回传保留作业关联；交付阶段与验收仍由 Teams 确认。</p><Collapse size="small" items={[{ key: 'work', label: '查看作业关联', children: <Descriptions column={1} size="small" items={[{ key: 'run', label: '运行', children: detail.activity.runId }, { key: 'session', label: '会话', children: detail.activity.sessionId ?? '尚未关联原生会话' }, { key: 'node', label: '节点', children: detail.activity.nodeId ?? '任务级回传' }, { key: 'time', label: '回传时间', children: detail.activity.at }]} /> }]} />{detail.activity.evidence.map((evidence, index) => <Button key={index} onClick={() => showText(evidence.description || '作业结果引用', evidence.value)}>查看结果引用：{evidence.description || evidence.value}</Button>)}</>}<Space wrap>{detail.route && <Button type="primary" onClick={() => jump(detail)}>{detail.pendingConfirmation ? '前往确认需求' : '进入交付节点'}</Button>}{projectId === 'carddemo' && detail.taskId === 'DEMO-MKT-001' && <Button onClick={() => navigate('projects?project=carddemo&tab=delivery&node=verify')}>查看 Review / 测试 / 安全报告</Button>}</Space>{detail.issues.map(issue => <Button key={issue.id} onClick={() => setDetail(issue)}>{issue.status} · {issue.source.title}</Button>)}{!detail.route && <p className="muted">此条目保留来源交付记录，尚无可进入的 Teams 交付任务。</p>}</> : <><Descriptions column={1} size="small" items={[{ key: 'status', label: '状态', children: detail.status }, { key: 'severity', label: '严重程度', children: detail.severity }, { key: 'owner', label: '来源负责人', children: detail.owner }, { key: 'progress', label: '处理进度', children: detail.progress }, { key: 'blocking', label: '交付影响', children: detail.blocksDelivery ? '阻塞当前交付' : '没有确认的交付阻塞记录' }]} />{detail.relatedIds.map(id => { const requirement = model.requirements.find(item => item.id === id); return requirement ? <Button key={id} onClick={() => setDetail(requirement)}>关联需求：{requirement.source.title}</Button> : null; })}{projectId === 'teams' && detail.source.sourceRecordId === 'TEAMS-BUG-001' && <Button onClick={() => navigate('projects?project=teams&tab=management&discussion=R20')}>查看 R20 复现讨论</Button>}</>}
      <Button onClick={() => showText(detail.source.title + ' · 来源原文', displayText(detail.source.detail))}>查看来源原文</Button>
    </div>}</Drawer>
  </div>;
}
