import { taskAssigneeName } from '../task-assignment.js';
import { displayText } from '../display-text.js';
import { useEffect, useMemo, useState } from 'react';
import { Button, Descriptions, Drawer, Empty, Select, Space, Steps, Table, Tabs, Tag } from 'antd';
import { ArrowRightOutlined, ApartmentOutlined, FolderOpenOutlined, RobotOutlined } from '@ant-design/icons';
import { useDemo } from '../context.js';
import { FrameworkCard } from '../vendor/teams/components/page-layout.js';
import { Heading, MiniStat, Origin, talentLink } from '../components/common.js';
import { stageLabels } from '../domain.js';
import { presence, teamUsage, type Presence } from '../operations.js';
import '../operations.css';
import '../project-overview.css';
import { ProjectKnowledge } from '../components/project-knowledge.js';
import { teamWorkIndex } from '../project-overview.js';
import { mainTask, taskAutomation } from '../task-automation.js';
import { getTools, type NativeStatus } from '../api.js';
import { TeamsPageIntro } from '../components/teams-reuse.js';

export function nextStep(state: ReturnType<typeof useDemo>['state']) {
  if (!state.knowledge) return { title: '在 Talents 挖掘并发布项目知识', note: 'Talents 读取项目已对接的代码仓与设计文档，审阅后发布到项目知识。', href: talentLink('knowledge', { role: 'owner' }), role: '项目 Owner' };
  if (!state.assigned) return { title: '确认并分配信用卡消费返现需求', note: '明确范围与验收标准，选择需求交付人。', href: '#/projects?tab=management', role: '项目 Owner' };
  if (!state.context) return { title: '准备 iCode 作业上下文', note: '查看需求背景，选用知识和业务 Skill，再进入开发。', href: '#/projects?tab=delivery&node=prepare', role: '项目成员' };
  if (state.stage === 'assigned') return { title: '进入 iCode 开发作业', note: '启动或恢复 iCode，读取本次作业上下文。', href: '#/projects?tab=delivery&node=develop', role: '项目成员' };
  if (state.stage === 'developing') return { title: '同步开发进度并完成检查', note: '通过基础协作能力回传进展，在 iCode 发起质量检查。', href: '#/projects?tab=delivery&node=develop', role: '项目成员' };
  if (['failed', 'returned'].includes(state.stage)) return { title: '处理问题并重新验证', note: '查看检查或退回依据，保留修复与复测结果。', href: '#/projects?tab=delivery&node=verify', role: '项目成员' };
  if (state.stage === 'fixed') return { title: '提交本次需求交付', note: '将代码、检查结果与未解决事项一起交给 Owner。', href: '#/projects?tab=delivery&node=verify', role: '项目成员' };
  if (state.stage === 'submitted') return { title: '确认白金卡消费返现结果', note: '核对返现金额、客户资格与周期边界，确认交付结果。', href: '#/projects?tab=delivery&node=accept', role: '项目 Owner' };
  const collection = taskAutomation(state, mainTask)?.collection;
  const reported = collection ? collection.reporting?.status === 'reported' : state.workspace.sessionReported;
  if (!reported) return { title: '查看验收后数据归集', note: '验收通过后自动归集本任务已关联的会话。', href: '#/trace', role: '项目 Owner' };
  if (state.workspace.analysis.status !== 'analyzed') return { title: '分析交付轨迹与业务经验', note: '在 Talents 选择单需求或项目多需求，查看改进机会。', href: talentLink('sessions'), role: '项目 Owner' };
  if (state.evolution === 'none') return { title: '形成 Agent 与业务 Skill 改进', note: '根据分析发现生成可评估的候选。', href: talentLink('evolution'), role: '项目 Owner' };
  if (state.evolution !== 'adopted') return { title: state.evolution === 'published' ? '采用能力新版本' : '评估并发布改进候选', note: '新版本供后续作业使用，本次已采用依据保持不变。', href: state.evolution === 'published' ? '#/resources' : talentLink('evolution'), role: '项目 Owner' };
  return { title: '查看交付与运营记录', note: '本次功能验收已完成，能力新版本可用于后续作业。', href: '#/team-work', role: '项目 Owner' };
}

type Tool = 'iCode' | 'OpenCode';
interface UsageRow { id: string; memberId: string; name: string; tool: Tool; model: string; tokens: number; input: number; output: number; status: Presence; project: string; task: string; lastActive: string; days: number; used: boolean }
interface MemberAgentRow { id: string; memberId: string; name: string; tool: Tool; project: string; task: string; sessionId: string; nodes: string; sources: string; lastActive: string }
const statusColor: Record<Presence, string | undefined> = { '未使用': undefined, '离线': undefined, '在线空闲': 'blue', '执行中': 'green', '等待人工处理': 'gold' };
const knowledgeStatusLabels = { running: '正在导入', ready: '输入已就绪', waiting: '等待输入就绪', failed: '导入未完成' } as const;
const collectionStatusLabels = { queued: '等待归集', running: '正在归集', collected: '已归集', empty: '暂无关联会话', failed: '归集未完成' } as const;
const evolutionStatusLabels = { none: '未开始', candidate: '候选待评估', evaluated: '评估已完成', published: '新版本待采用', adopted: '新版本已采用' } as const;
const formatTokens = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(2)}M` : n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}K` : String(n);
function useUsageRows(days: number) {
  const { state } = useDemo();
  return useMemo(() => {
    const samples = teamUsage(state);
    return state.workspace.team.members.filter(m => m.status === 'active').flatMap(member => {
      const sample = samples.find(s => s.name === member.name), used = sample?.used ?? false;
      const today = sample?.tokens ?? 0, total = days === 1 ? today : today * 4 + (used ? 48000 : 0);
      const status = sample ? presence(sample) : '未使用';
      const task = sample?.instances[0]?.task ?? '尚无执行记录';
      const project = ['owner', 'member'].includes(member.id) ? state.workspace.project.name : sample?.instances[0]?.project ?? '尚未分配';
      const make = (tool: Tool, tokens: number, current: Presence): UsageRow => ({ id: `${member.id}-${tool}`, memberId: member.id, name: member.name, tool, model: tool === 'iCode' ? '组织默认模型 A' : '组织默认模型 B', tokens, input: Math.round(tokens * .74), output: tokens - Math.round(tokens * .74), status: current, project, task: tool === 'OpenCode' ? '接口用例补充' : task, lastActive: sample?.lastActive ?? '尚无记录', days, used });
      return member.name === '苏晴' ? [make('iCode', Math.round(total * .7), status), make('OpenCode', total - Math.round(total * .7), '在线空闲')] : [make('iCode', total, status)];
    });
  }, [state, days]);
}

export function Home() {
  const { state, data, role, navigate } = useDemo(), owner = role === 'owner';
  const [member, setMember] = useState('all'), [tool, setTool] = useState('all'), [period, setPeriod] = useState('today'), [selected, setSelected] = useState<UsageRow | null>(null);
  const [nativeTools, setNativeTools] = useState<NativeStatus>(), [nativeToolsError, setNativeToolsError] = useState('');
  useEffect(() => {
    let live = true;
    getTools().then(result => { if (live) setNativeTools(result); }).catch(error => { if (live) setNativeToolsError((error as Error).message); });
    return () => { live = false; };
  }, []);
  const rows = useUsageRows(period === 'today' ? 1 : 7);
  const filtered = rows.filter(row => (owner ? member === 'all' || row.memberId === member : row.memberId === 'member') && (tool === 'all' || row.tool === tool));
  const memberAgentRows = useMemo(() => teamWorkIndex(state, data).flatMap(entry => entry.sessions.map(session => ({
    id: `${entry.id}:${session.tool}:${session.sessionId}`,
    memberId: state.workspace.team.members.find(item => item.name === entry.item.owner)?.id ?? entry.item.owner,
    name: entry.item.owner,
    tool: session.tool === 'icode' ? 'iCode' as const : 'OpenCode' as const,
    project: entry.projectName,
    task: entry.item.source.title,
    sessionId: session.sessionId,
    nodes: session.nodeIds.join(' / '),
    sources: session.sources.join('、'),
    lastActive: session.lastAt,
  }))), [state, data]);
  const agentFiltered = memberAgentRows.filter(row => (owner ? member === 'all' || row.memberId === member : row.memberId === 'member') && (tool === 'all' || row.tool === tool));
  const people = [...new Set(filtered.map(row => row.memberId))];
  const tokenPeople = people.filter(id => filtered.some(row => row.memberId === id && row.tokens > 0)), zeroTokenPeople = people.length - tokenPeople.length;
  const countPeople = (predicate: (row: UsageRow) => boolean) => new Set(filtered.filter(predicate).map(row => row.memberId)).size;
  const used = countPeople(row => row.used), active = countPeople(row => row.tokens > 0), online = countPeople(row => ['在线空闲', '执行中', '等待人工处理'].includes(row.status)), running = countPeople(row => row.status === '执行中');
  const tokens = filtered.reduce((sum, row) => sum + row.tokens, 0), input = filtered.reduce((sum, row) => sum + row.input, 0);
  const requested = new URLSearchParams(location.hash.split('?')[1]).get('tab') ?? 'overview';
  const tabs = owner ? [{ key: 'overview', label: '运营概览' }, { key: 'projects', label: '项目进度' }, { key: 'tools', label: '工具使用' }, { key: 'tokens', label: 'Token 用量' }] : [{ key: 'overview', label: '我的任务与待办' }, { key: 'jobs', label: '进行中的作业' }, { key: 'tokens', label: '个人用量' }];
  const tab = tabs.some(item => item.key === requested) ? requested : 'overview';
  const next = nextStep(state), mine = next.role === (owner ? '项目 Owner' : '项目成员'), timeline = state.workspace.progress;
  const mainAutomation = taskAutomation(state, mainTask);
  const activity = [
    ...timeline.map(item => ({ id: 'progress-' + item.id, text: item.text, at: item.at, source: '手工进度', actor: '陈晨' })),
    ...(state.workspace.collaboration?.events ?? []).filter(item => item.projectId === 'carddemo' && item.taskId === 'DEMO-MKT-001').map(item => ({ id: 'event-' + item.id, text: item.summary, at: item.at, source: 'Teams CLI 回传', actor: item.role === 'owner' ? '林悦' : '陈晨' })),
    ...state.audit.filter(item => !item.action.startsWith('Teams CLI ·')).map(item => ({ id: 'audit-' + item.id, text: item.action, at: item.at, source: item.system + ' 工作流', actor: item.role === 'owner' ? '林悦' : '陈晨' })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4);
  const hasActivity = activity.length > 0 || state.stage === 'returned';
  const personalActivity = activity.filter(item => item.actor === '陈晨'), hasPersonalActivity = personalActivity.length > 0 || state.stage === 'returned';
  const showAutomation = !!mainAutomation || state.stage === 'accepted' || state.workspace.analysis.status === 'analyzed' || state.evolution !== 'none';
  const stats = <div className="metrics-row ops-metrics" data-testid="team-usage-metrics"><MiniStat label="已使用人数" value={`${used} / ${people.length}`} note="按当前成员筛选去重" /><MiniStat label={period === 'today' ? '今日使用人数' : '近 7 日使用人数'} value={active} note="有使用记录的成员" /><MiniStat label="当前在线人数" value={online} note="含空闲、运行与等待" /><MiniStat label="正在执行人数" value={running} note="按运行成员去重" /></div>;
  const filters = <div className="ops-filters"><Space wrap>{owner && <Select aria-label="筛选运营成员" value={member} onChange={setMember} options={[{ value: 'all', label: '全部成员' }, ...state.workspace.team.members.filter(m => m.status === 'active').map(m => ({ value: m.id, label: m.name }))]} />}<Select aria-label="筛选运营工具" value={tool} onChange={setTool} options={[{ value: 'all', label: '全部工具' }, { value: 'iCode', label: 'iCode' }, { value: 'OpenCode', label: 'OpenCode' }]} /><Select aria-label="筛选运营时间" value={period} onChange={setPeriod} options={[{ value: 'today', label: '10 月 26 日' }, { value: 'week', label: '近 7 日 · 10 月 20–26 日' }]} /></Space><Origin kind="simulated" /></div>;
  const usageTable = <Table<UsageRow> rowKey="id" size="middle" pagination={false} scroll={{ x: 680 }} dataSource={filtered} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前筛选范围暂无使用记录" /> }} columns={[
    { title: '成员 / 工具', key: 'member', width: 140, render: (_, row) => <div className="ops-table-person"><strong>{row.name}</strong><small>{row.tool}</small></div> },
    { title: '当前状态', key: 'status', width: 125, render: (_, row) => <Tag color={statusColor[row.status]}>{row.status}</Tag> },
    { title: '任务与项目', key: 'task', render: (_, row) => <div className="ops-table-person"><strong>{displayText(row.task)}</strong><small>{row.project}</small></div> },
    { title: 'Token', key: 'tokens', width: 90, render: (_, row) => formatTokens(row.tokens) },
    { title: '操作', key: 'open', width: 80, render: (_, row) => <Button type="link" size="small" onClick={() => setSelected(row)}>明细</Button> },
  ]} />;
  const memberAgentTable = <Table<MemberAgentRow> rowKey="id" size="middle" pagination={false} scroll={{ x: 900 }} dataSource={agentFiltered} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未关联成员 Agent 会话" /> }} columns={[
    { title: '成员', dataIndex: 'name', width: 100 }, { title: 'Agent', dataIndex: 'tool', width: 110 },
    { title: '关联任务 / 项目', key: 'task', render: (_, row) => <div className="ops-table-person"><strong>{displayText(row.task)}</strong><small>{row.project}</small></div> },
    { title: '会话 / 节点', key: 'session', width: 230, render: (_, row) => <div className="ops-table-person"><strong>{row.sessionId}</strong><small>{row.nodes}</small></div> },
    { title: '来源', dataIndex: 'sources', width: 150 },
    { title: '最近关联', key: 'lastActive', width: 170, render: (_, row) => new Date(row.lastActive).toLocaleString('zh-CN', { hour12: false }) },
  ]} />;
  const localAgents = [
    { name: 'iCode', installed: nativeTools?.icode.installed, version: nativeTools?.icode.version },
    { name: 'OpenCode', installed: nativeTools?.opencode.installed, version: nativeTools?.opencode.version },
  ];
  return <div className="page-stack ops-page"><TeamsPageIntro actions={<Tag color="purple">{owner ? '林悦 · 项目 Owner' : '陈晨 · 项目成员'}</Tag>}>{state.workspace.team.name} · {owner ? '团队运营与交付进展' : '我的工作与待办'}</TeamsPageIntro>
    <Tabs activeKey={tab} onChange={value => navigate('home?tab=' + value)} items={tabs} />
    {(owner && !['overview', 'projects'].includes(tab) || !owner && ['tokens', 'jobs'].includes(tab)) && filters}
    {owner && tab === 'tools' && stats}
    {tab === 'overview' && <div className="ops-owner-overview">
      <div className="ops-overview-hero">
        <FrameworkCard title="当前需求与下一步" action={<Button type="link" onClick={() => navigate('projects?tab=delivery')}>打开交付流程</Button>}><div className="ops-current-requirement"><div className="ops-requirement-meta"><span>{state.workspace.project.name} · {mainTask.taskId}</span><Tag color={stageLabels[state.stage].includes('待') ? 'gold' : 'purple'}>{stageLabels[state.stage]}</Tag></div><h3>信用卡消费返现</h3><p>{state.workspace.project.description}</p><div className="ops-next-action"><div><span>{mine ? '待我处理' : '当前等待 · ' + next.role}</span><strong>{next.title}</strong><p>{next.note}</p></div><Button type={mine ? 'primary' : 'default'} href={mine ? next.href : '#/projects?tab=delivery'}>{mine ? '前往处理' : '查看协作'}</Button></div><DeliverySteps /></div></FrameworkCard>
        {owner ? <FrameworkCard title="开工准备" action={<Tag color={state.context ? 'green' : undefined}>{state.context ? '已就绪' : '准备中'}</Tag>}><div className="ops-readiness-list"><div className="ops-readiness-row"><span>项目资料</span><strong>{state.workspace.project.assets.length} 项已关联</strong></div><div className="ops-readiness-knowledge"><ProjectKnowledge projectId="carddemo" compact /></div><div className="ops-readiness-row"><span>需求分配</span><Tag color={state.assigned ? 'green' : 'gold'}>{state.assigned ? taskAssigneeName(state) + ' · 已分配' : '待确认'}</Tag></div><div className="ops-readiness-row ops-readiness-stack"><span>能力与版本</span><strong>{state.workspace.selectedSkills.length} 项 Skill · Agent {state.adoptedAgent}</strong><small>{state.context ? '本次采用版本已冻结' : '当前为项目可用能力，尚未冻结'}</small></div><div className="ops-readiness-row"><span>作业上下文</span><Tag color={state.context ? 'green' : undefined}>{state.context ? '已冻结' : '未冻结'}</Tag></div></div></FrameworkCard> : <FrameworkCard title="我的任务概况"><div className="ops-readiness-list"><div className="ops-readiness-row"><span>分配给我的需求</span><strong>{state.assigned ? '01' : '00'}</strong></div><div className="ops-readiness-row"><span>当前阶段</span><Tag color={stageLabels[state.stage].includes('待') ? 'gold' : 'purple'}>{stageLabels[state.stage]}</Tag></div><div className="ops-readiness-row"><span>检查情况</span><strong>{state.checks === 'failed' ? '待修复' : state.checks === 'passed' ? '复测通过' : '待执行'}</strong></div><div className="ops-readiness-row"><span>已同步进度</span><strong>{timeline.length} 条</strong></div></div></FrameworkCard>}
      </div>
      {owner ? (hasActivity || showAutomation) && <div className={hasActivity && showAutomation ? 'ops-overview-secondary' : 'ops-overview-secondary single'}>
        {hasActivity && <FrameworkCard title="交付与协作动态" action={<Button type="link" onClick={() => navigate('trace')}>查看执行记录</Button>}>{state.stage === 'returned' && <div className="ops-feedback"><strong>Owner 要求补充</strong><p>{state.returnReason}</p></div>}{activity.length ? <div className="ops-feed">{activity.map(item => <div key={item.id}><span className="activity-dot" /><div><strong>{displayText(item.text)}</strong><small>{item.source} · {item.actor} · {new Date(item.at).toLocaleString('zh-CN')}</small></div></div>)}</div> : <p className="muted">当前还没有进度或协作记录。</p>}</FrameworkCard>}
        {showAutomation && <FrameworkCard title="自动化与后续" action={<Tag>任务自动化</Tag>}><div className="ops-readiness-list"><div className="ops-readiness-row"><span>知识导入</span><strong>{mainAutomation?.knowledge ? knowledgeStatusLabels[mainAutomation.knowledge.status] : '未触发'}</strong></div><div className="ops-readiness-row"><span>验收后归集</span><strong>{mainAutomation?.collection ? collectionStatusLabels[mainAutomation.collection.status] : state.stage === 'accepted' ? '待归集' : '待验收'}</strong></div><div className="ops-readiness-row ops-readiness-stack"><span>Talents 共享</span><strong>{mainAutomation?.collection?.reporting?.status === 'reported' ? '已共享' : mainAutomation?.collection?.reporting?.status === 'failed' ? '共享未完成' : mainAutomation?.collection?.reporting?.status === 'uploading' ? '正在共享' : '尚未共享'}</strong><small>{mainAutomation?.collection?.reporting?.reason ?? '仅取得共享目录写入回执才标记已共享'}</small></div><div className="ops-readiness-row ops-readiness-stack"><span>能力演进</span><strong>{evolutionStatusLabels[state.evolution]}</strong><small>当前 Skill {state.adoptedSkill} · Agent {state.adoptedAgent}</small></div></div></FrameworkCard>}
      </div> : hasPersonalActivity && <div className="ops-overview-secondary single"><FrameworkCard title="我的执行与反馈" action={<Button type="link" onClick={() => navigate('trace')}>查看执行记录</Button>}>{state.stage === 'returned' && <div className="ops-feedback"><strong>Owner 要求补充</strong><p>{state.returnReason}</p></div>}{personalActivity.length ? <div className="ops-feed">{personalActivity.map(item => <div key={item.id}><span className="activity-dot" /><div><strong>{displayText(item.text)}</strong><small>{item.source} · {item.actor} · {new Date(item.at).toLocaleString('zh-CN')}</small></div></div>)}</div> : <p className="muted">当前还没有个人执行记录。</p>}<Space wrap><Button onClick={() => navigate('projects?tab=delivery&node=develop')}>查看开发节点</Button><Button onClick={() => navigate('trace')}>查看执行记录</Button></Space></FrameworkCard></div>}
      {owner ? <div className="ops-usage-card"><FrameworkCard title="团队使用概览" action={<Button type="link" onClick={() => navigate('home?tab=tokens')}>查看用量分析 <ArrowRightOutlined /></Button>}>{filters}<div className="ops-usage-content">{stats}<div className="ops-usage-token"><span>当前筛选范围 · {period === 'today' ? '今日' : '近 7 日'}</span><strong>{formatTokens(tokens)}</strong><small>Token</small></div></div></FrameworkCard></div> : <div className="ops-usage-card"><FrameworkCard title="我的用量" action={<Button type="link" onClick={() => navigate('home?tab=tokens')}>查看用量分析 <ArrowRightOutlined /></Button>}><div className="ops-usage-token ops-usage-token-compact"><span>本人 · {period === 'today' ? '今日' : '近 7 日'} Token</span><strong>{formatTokens(tokens)}</strong></div></FrameworkCard></div>}
      <nav className="ops-overview-links" aria-label="常用入口"><strong>常用入口</strong><div><a href="#/agent">Agent 管理</a><a href="#/projects?tab=content">项目空间</a><a href="#/resources">资源市场</a><a href={talentLink('knowledge')}>Talents 知识与演进</a></div></nav>
    </div>}
    {tab === 'projects' && <><div className="metrics-row ops-metrics"><MiniStat label="当前项目" value="1" note={state.workspace.project.name} /><MiniStat label="已分配需求" value={state.assigned ? 1 : 0} note={mainTask.taskId} /><MiniStat label="待验收" value={state.stage === 'submitted' ? 1 : 0} note="等待 Owner 确认" /><MiniStat label="已完成" value={state.stage === 'accepted' ? 1 : 0} note="功能验收通过" /></div><FrameworkCard title={state.workspace.project.name} action={<Button type="primary" onClick={() => navigate('projects?tab=delivery')}>进入项目交付</Button>}><div className="ops-project-progress"><DeliverySteps /><div className="ops-stage-summary"><span><strong>负责人</strong> {taskAssigneeName(state)}</span><span><strong>当前状态</strong> {stageLabels[state.stage]}</span><span><strong>最近进展</strong> {timeline.at(-1)?.text ?? '等待开发进度回传'}</span></div></div>{state.stage === 'returned' && <p className="ops-feedback">待处理：{state.returnReason}</p>}</FrameworkCard><FrameworkCard title="当前筛选范围的执行活动" action={<Tag>{filtered.length} 个工具记录</Tag>}><div className="ops-card-filters">{filters}</div>{usageTable}</FrameworkCard></>}
    {['tools', 'jobs'].includes(tab) && <>{!owner && stats}<div className="ops-two ops-tools-summary"><FrameworkCard title="执行用量分布">{(['iCode', 'OpenCode'] as const).map(name => { const scoped = filtered.filter(row => row.tool === name), total = scoped.reduce((sum, row) => sum + row.tokens, 0); return <div key={name} className="ops-tool-stat"><RobotOutlined /><div><strong>{name}</strong><span>{new Set(scoped.filter(row => row.used).map(row => row.memberId)).size} 人使用 · {new Set(scoped.filter(row => row.status === '执行中').map(row => row.memberId)).size} 人正在执行</span></div><b>{formatTokens(total)}</b></div>; })}</FrameworkCard><FrameworkCard title="运行状态">{(['执行中', '等待人工处理', '在线空闲', '离线', '未使用'] as const).map(name => <div className="ops-state-row" key={name}><Tag color={statusColor[name]}>{name}</Tag><span>{filtered.filter(row => row.status === name).length} 条工具记录</span></div>)}</FrameworkCard></div><FrameworkCard title={owner ? '成员 Agent 使用与本机安装' : '我的作业与工具'} action={owner ? <Origin kind="native" /> : <Button onClick={() => navigate('agent')}>管理本机实例</Button>}>{owner ? <><h3 className="ops-section-title">本机安装</h3><div className="ops-local-agents">{localAgents.map(agent => <div key={agent.name}><strong>{agent.name}</strong><Tag color={agent.installed ? 'green' : undefined}>{nativeToolsError ? '未核验' : agent.installed === undefined ? '探测中' : agent.installed ? '已安装' : '未安装'}</Tag><small>{nativeToolsError ? '请检查本机服务' : agent.version ?? (agent.installed === undefined ? '正在读取本机状态' : '版本未取得')}</small></div>)}</div><h3 className="ops-section-title">成员 Agent 会话</h3>{agentFiltered.length ? memberAgentTable : <div className="ops-compact-empty">当前筛选没有成员 Agent 会话关联</div>}<p className="ops-subnote">成员使用仅来自任务会话关联；安装状态仅代表当前设备与当前系统用户。Claude Code、Codex 当前未接入，不展示虚构安装记录。</p>{nativeToolsError && <p className="ops-subnote">本机探测失败：{nativeToolsError}</p>}</> : usageTable}</FrameworkCard></>}
    {tab === 'tokens' && <>
      <div className="metrics-row ops-metrics"><MiniStat label="Token 总量" value={formatTokens(tokens)} note={period === 'today' ? '当日累计' : '近 7 日累计'} /><MiniStat label="输入 Token" value={formatTokens(input)} note="请求与上下文" /><MiniStat label="输出 Token" value={formatTokens(tokens - input)} note="模型返回" /><MiniStat label="人均 Token" value={formatTokens(active ? Math.round(tokens / active) : 0)} note="按有使用记录的成员" /></div>
      <div className="ops-two"><FrameworkCard title={period === 'today' ? '当日用量分布' : '近 7 日用量趋势'} action={<Origin kind="simulated" />}><TokenTrend total={tokens} days={period === 'today' ? 1 : 7} /></FrameworkCard><FrameworkCard title="按成员分布"><div className="ops-bars">{tokenPeople.map(id => { const scoped = filtered.filter(row => row.memberId === id), sum = scoped.reduce((n, row) => n + row.tokens, 0); return <div key={id}><div><span>{scoped[0].name}</span><strong>{formatTokens(sum)}</strong></div><div className="ops-bar-track"><i style={{ width: `${tokens ? sum / tokens * 100 : 0}%` }} /></div></div>; })}{!tokenPeople.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前范围暂无用量" />}{zeroTokenPeople > 0 && <p className="ops-subnote">另有 {zeroTokenPeople} 位当前范围未使用成员，未计入分布。</p>}</div></FrameworkCard></div>
      <FrameworkCard title="用量明细" action={<Tag>{period === 'today' ? '2026-10-26' : '2026-10-20 至 2026-10-26'}</Tag>}><Table<UsageRow> rowKey="id" size="middle" pagination={false} scroll={{ x: 700 }} dataSource={filtered.filter(row => row.tokens > 0)} columns={[{ title: '成员', dataIndex: 'name', width: 90 }, { title: '工具 / 模型', key: 'tool', render: (_, row) => <div className="ops-table-person"><strong>{row.tool}</strong><small>{row.model}</small></div> }, { title: '项目', dataIndex: 'project' }, { title: '输入', key: 'input', render: (_, row) => row.input.toLocaleString() }, { title: '输出', key: 'output', render: (_, row) => row.output.toLocaleString() }, { title: '关联作业', key: 'open', render: (_, row) => <Button size="small" type="link" onClick={() => setSelected(row)}>查看明细</Button> }]} /><p className="ops-subnote">输入和输出独立计数，可沿作业查看需求关联。</p></FrameworkCard>
    </>}
    <Drawer title="工具与用量明细" open={!!selected} onClose={() => setSelected(null)} width={540}>{selected && <><Origin kind="simulated" /><h2>{selected.name} · {selected.tool}</h2><Descriptions column={1} bordered size="small" items={[{ key: 'status', label: '当前状态', children: <Tag color={statusColor[selected.status]}>{selected.status}</Tag> }, { key: 'task', label: '关联任务', children: displayText(selected.task) }, { key: 'project', label: '项目', children: selected.project }, { key: 'model', label: '模型', children: selected.model }, { key: 'period', label: '统计范围', children: selected.days === 1 ? '2026-10-26' : '2026-10-20 至 2026-10-26' }, { key: 'input', label: '输入 Token', children: selected.input.toLocaleString() }, { key: 'output', label: '输出 Token', children: selected.output.toLocaleString() }, { key: 'active', label: '最近活跃', children: selected.lastActive }]} /><div className="card-actions">{selected.memberId === 'member' ? <><Button type="primary" onClick={() => { setSelected(null); navigate('projects?tab=delivery&node=develop'); }}>查看信用卡消费返现任务</Button><Button onClick={() => { setSelected(null); navigate('trace'); }}>关联会话与轨迹</Button></> : <p className="muted">此作业暂无更多交付记录。</p>}</div></>}</Drawer>
  </div>;
}
function DeliverySteps() {
  const { state } = useDemo();
  const current = !state.context ? 0 : ['assigned', 'developing', 'returned'].includes(state.stage) ? 1 : ['failed', 'fixed'].includes(state.stage) ? 2 : 3;
  return <Steps size="small" current={current} status={['failed', 'returned'].includes(state.stage) ? 'error' : state.stage === 'accepted' ? 'finish' : state.stage === 'draft' ? 'wait' : 'process'} items={[{ title: '需求准备' }, { title: '开发' }, { title: '验证' }, { title: '验收' }]} />;
}
function TokenTrend({ total, days }: { total: number; days: number }) {
  const weights = days === 1 ? [4, 12, 20, 16, 27, 21] : [9, 13, 11, 18, 16, 14, 19];
  const labels = days === 1 ? ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'] : ['10/20', '10/21', '10/22', '10/23', '10/24', '10/25', '10/26'];
  return <div className="ops-trend" role="img" aria-label={`${days === 1 ? '今日' : '近七日'} Token 用量趋势，总计 ${total}`}><div className="ops-trend-bars">{weights.map((weight, index) => <div className="ops-trend-column" key={labels[index]}><small>{formatTokens(Math.round(total * weight / 100))}</small><div><i style={{ height: total ? `${weight / Math.max(...weights) * 100}%` : '0%' }} /></div><span>{labels[index]}</span></div>)}</div></div>;
}
