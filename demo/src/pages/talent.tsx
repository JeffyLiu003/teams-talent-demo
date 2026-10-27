import { useState } from 'react';
import type { Presentation } from '../api.js';
import { Alert, Button, Descriptions, Empty, Segmented, Space, Steps, Table, Tabs, Tag } from 'antd';
import { ArrowRightOutlined, BookOutlined, CheckCircleOutlined, CodeOutlined, ExperimentOutlined, FileSearchOutlined, FileTextOutlined, RobotOutlined } from '@ant-design/icons';
import { useDemo } from '../context.js';
import { FrameworkCard } from '../vendor/teams/components/page-layout.js';
import { ActionButton, Heading, Mono, Origin, MiniStat, StatusLine, teamsLink, talentLink } from '../components/common.js';
import { createSourcePluginCatalog, sourceAssetKindLabels, type SourceAssetKind } from '../source-plugins.js';
import { displayRequirementId, displayText } from '../display-text.js';
import { displayTalentArtifact } from '../talent-artifacts.js';
import '../talent.css';

export const knowledgeRules = [
  { id: 'K-01', title: '白金卡资格独立校验', text: '在计算返现前校验卡片等级；普通卡不能进入白金卡专属返现路径。', source: '白金卡返现资格校验', evidence: 'E4', category: '业务状态' },
  { id: 'K-02', title: '同一交易只奖励一次', text: '同一交易只写入一次；重复提交不会再次改动交易或欠款余额。', source: 'demo/src/domain.ts / purchase', evidence: 'E7', category: '业务规则' },
  { id: 'K-03', title: '明确交易与回传边界', text: '交易写入通过版本校验避免重复；Talent 回传失败保留待回传结果，重试不重建成果。真实账务重试仍待验证。', source: '交易与返现处理边界', evidence: null, document: 'demo/docs/cashback-integration.md', category: '异常处理' },
  { id: 'K-04', title: '按最小货币单位计算返现', text: '符合条件的消费额外返现 0.5%，以分为单位计算并四舍五入；金额与周期边界单独验证。', source: '白金卡返现规则', evidence: null, document: 'demo/docs/cashback-contract.md', category: '业务规则' },
];

export function openKnowledgeRule(rule: (typeof knowledgeRules)[number], data: Pick<Presentation, 'sources' | 'evidence'>, showEvidence: (id: string) => void, showText: (title: string, content: string) => void) {
  if (rule.evidence && data.evidence.some(item => item.id === rule.evidence)) { showEvidence(rule.evidence); return; }
  const source = data.sources.find(item => item.file === rule.document);
  showText(source?.file ?? rule.title, source?.content ?? '来源暂不可用，请重新关联项目资料。');
}

export function Knowledge() {
  const { data, role, showText } = useDemo();
  const snapshot = data.talent;
  if (!snapshot) return <Alert type="error" title="Talent 知识状态缺失，请重新加载服务" />;
  const { project, context } = snapshot;
  const ready = project.knowledge.status === 'ready';
  if (context.id === 'carddemo' && ready) return <CardKnowledge />;
  const catalog = createSourcePluginCatalog(data);
  return <div className="page-stack talent-v2">
    <Heading eyebrow="TALENT / 知识资产库" title={context.name + ' · 知识空间'} description="集中管理项目知识资产与构建结果，保留 Teams 项目资料的来源。" actions={<Button href={teamsLink('projects?tab=content')}>返回 Teams 项目</Button>} />
    <FrameworkCard title="知识构建">
      {!ready ? <Empty description="此项目尚未在 Talent 构建知识，业务知识插件当前没有可用成果。" /> : <Tag color="green">{project.knowledge.version} · 来源索引</Tag>}
      <p>已关联 {context.assets.length} 项输入。原始文档由文档插件提供；代码图谱可由本地工具生成后作为输入。当前结果基于已关联资料；来源与覆盖范围可在详情中核对。</p>
      {role === 'owner' && <ActionButton action="knowledge" role="owner" disabled={ready || !context.assets.length}>在 Talent 构建项目知识</ActionButton>}
    </FrameworkCard>
    {ready && <FrameworkCard title="知识资产"><Table rowKey="id" pagination={false} scroll={{x:520}} dataSource={project.knowledge.assets} columns={[{title:'知识',dataIndex:'title',render:title=>displayText(title)}, {title:'版本',dataIndex:'version'}, {title:'内容',render:(_,asset)=><Button onClick={()=>showText(displayText(asset.title),displayTalentArtifact(asset.detail))}>阅读知识</Button>}]} /><p className="muted">当前为可追溯来源索引，尚未抽取并确认项目业务规则。</p></FrameworkCard>}
    <FrameworkCard title="Teams 项目输入"><Table rowKey="id" pagination={false} scroll={{x:600}} dataSource={context.assets} columns={[{title:'资料',dataIndex:'title'},{title:'类型',dataIndex:'kind',render:kind=>sourceAssetKindLabels[kind as SourceAssetKind] ?? kind},{title:'引用',dataIndex:'location'}]} />
      {project.knowledge.assets.flatMap(asset=>asset.references).filter((reference,index,all)=>all.findIndex(other=>other.collection===reference.collection&&other.path===reference.path)===index).map(reference=><Button key={reference.path} onClick={()=>{const body=catalog.readReference(reference);showText(reference.path,body ?? '此本地引用未包含在当前导入快照中。');}}>{reference.label}</Button>)}
    </FrameworkCard>
  </div>;
}

export function KnowledgeGraph({ graph, selectedId, onSelect, showText }: {
  graph: Presentation['graph']; selectedId?: string; onSelect(id: string): void; showText(title: string, content: string): void;
}) {
  const node = graph.find(item => item.id === selectedId) ?? graph[0];
  return <FrameworkCard title="白金卡返现 · 需求影响路径"><div className="source-graph">{graph.map((n, i) => <div className="graph-step" key={n.id}><button className={'graph-node ' + (node?.id === n.id ? 'selected' : '')} onClick={() => onSelect(n.id)} aria-pressed={node?.id === n.id}><span><CodeOutlined /> 0{i + 1}</span><strong>{n.name}</strong><small>{n.file.split('/').slice(-2, -1)[0] ?? '代码节点'}</small></button>{i < graph.length - 1 && <div className="graph-edge"><small>关联</small><ArrowRightOutlined /></div>}</div>)}</div>{node ? <div className="source-detail"><div><Tag color="blue">{node.name}</Tag><h3>{node.description}</h3><Mono>{node.file}</Mono><div className="card-actions"><Button size="small" onClick={() => showText(node.file, node.excerpt)}>展开源码依据</Button></div></div><pre className="evidence-console source-console">{node.excerpt}</pre></div> : <Empty description="暂无代码关系，请先关联项目资料" />}<p className="muted">关系图保留输入文件及代码节选，点击节点查看依据。</p></FrameworkCard>;
}

function CardKnowledge() {
  const { state, data, showText, showEvidence, role } = useDemo();
  const [selected, setSelected] = useState<string>();
  const project = data.talent!.context;
  const stateKnowledge = data.talent!.project.knowledge.status === 'ready';
  const rules = knowledgeRules.filter(rule => data.talent!.project.knowledge.assets.some(asset => asset.sourceRecordId === rule.id));
  return <div className="page-stack talent-v2">
    <Heading eyebrow="TALENT / 项目知识" title={project.name + ' · 知识空间'} description="依据 Teams 项目资产，将代码关系、业务规则和原始资料联系起来。" actions={<Button href={teamsLink('projects?tab=content')}>返回 Teams 项目 <ArrowRightOutlined /></Button>} />
    <div className="talent-banner"><div><Tag color="blue">CardDemo</Tag><Tag color={stateKnowledge ? 'green' : 'gold'}>{stateKnowledge ? 'knowledge-v1 可供采用' : '等待 Teams 发起整合'}</Tag><h2>从项目资产到开发上下文</h2><p>白金卡资格、周期边界、奖励计算与账户入账，在同一知识空间中保留出处。</p></div><Button type="primary" href={teamsLink('projects?tab=content')}>{stateKnowledge ? '在 Teams 查看知识采用' : role === 'owner' ? '在 Teams 发起知识整合' : '查看 Teams 项目资料'}</Button></div>
    <div className="metrics-row"><MiniStat label="Teams 登记资产" value={project.assets.length} note="输入与关联由 Teams 管理" /><MiniStat label="源码关系节点" value={data.graph.length} note="已关联代码关系输入" /><MiniStat label="业务知识条目" value={rules.length} note={stateKnowledge ? '已关联知识版本' : '预览整合结果'} /><MiniStat label="知识版本" value={stateKnowledge ? 'v1' : '待生成'} note="用于需求上下文选择" /></div>
    {!stateKnowledge && <Alert type="info" showIcon title="下面是知识结果预览" description="项目 Owner 在 Teams 选择已关联资料并发起整合。Talent 展示整合状态、知识成果和来源。" />}
    <Tabs defaultActiveKey="overview" items={[
      { key: 'overview', label: '整合概览', children: <div className="talent-grid-two"><FrameworkCard title="知识整合任务"><Steps direction="vertical" current={stateKnowledge ? 3 : 0} items={[{ title: 'Teams 项目资产', description: `${project.assets.length} 项已登记资产，由项目 Owner 管理` }, { title: '代码关系与规则整理', description: '使用已有代码关系输入与资料引用整理项目知识' }, { title: 'knowledge-v1', description: '生成带有来源的项目知识成果' }, { title: '需求引用', description: state.context ? `CTX-MKT-001 已引用 ${state.context.knowledgeVersion}` : '成员从 Teams 需求澄清选用项目知识' }]} /></FrameworkCard><FrameworkCard title="知识覆盖范围"><div className="talent-scope-list">{['活动中心：客户资格与权益展示', '交易服务：消费入账与营销评估', '营销服务：周期、金额、去重和重试', '账户服务：奖励冲减欠款'].map((text, i) => <div key={text}><span>{String(i + 1).padStart(2, '0')}</span><p>{text}</p></div>)}</div><Alert type="info" title="知识依据保留在结果中" description="代码关系来源于已关联的文件节选，完整范围以输入资料为准。" /></FrameworkCard></div> },
      { key: 'graph', label: '代码图谱', children: <KnowledgeGraph graph={data.graph} selectedId={selected} onSelect={setSelected} showText={showText} /> },
      { key: 'business', label: '业务知识', children: <div className="talent-rule-grid">{rules.map(k => <FrameworkCard key={k.id} title={k.id} action={<Tag color="purple">{k.category}</Tag>}><BookOutlined className="knowledge-icon" /><h3>{k.title}</h3><p>{k.text}</p><small className="muted">{k.source}</small><div className="card-actions"><Button size="small" onClick={() => { openKnowledgeRule(k, data, showEvidence, showText); }}>查看来源依据</Button><Tag color={stateKnowledge ? 'green' : 'default'}>{stateKnowledge ? 'knowledge-v1' : '结果预览'}</Tag></div></FrameworkCard>)}</div> },
      { key: 'sources', label: '资料与版本', children: <div className="page-stack"><FrameworkCard title="Teams 已关联的项目资产" action={<Button size="small" href={teamsLink('projects?tab=content')}>管理项目资产</Button>}><Table size="small" rowKey="id" pagination={false} scroll={{ x: 620 }} dataSource={project.assets} columns={[{ title: '资产', dataIndex: 'title' }, { title: '类型', dataIndex: 'kind', width: 110 }, { title: '位置与引用', dataIndex: 'location', render: value => <span className="talent-break">{value}</span> }]} /><p className="muted">这里显示 Teams 提供的项目资产引用；构建版本与知识正文由独立 Talent 服务保存。</p></FrameworkCard><FrameworkCard title="设计材料与来源">{data.sources.map(s => <div className="document-row" key={s.file}><FileTextOutlined /><div><strong>{s.file.split('/').at(-1)}</strong><p>{s.file}</p></div><Button onClick={() => showText(s.file, s.content)}>阅读材料</Button></div>)}</FrameworkCard><FrameworkCard title="知识版本与引用"><Descriptions column={2} size="small" items={[{ key: 'version', label: '当前版本', children: stateKnowledge ? 'knowledge-v1' : '尚未生成' }, { key: 'owner', label: '整合发起方', children: 'Talent · 项目 Owner' }, { key: 'sources', label: '内容依据', children: '已关联代码节点与设计资料' }, { key: 'use', label: '需求采用', children: state.context ? `CTX-MKT-001 / ${state.context.knowledgeVersion}` : '等待成员准备需求上下文' }]} /><div className="card-actions"><Button type="primary" disabled={!stateKnowledge} href={teamsLink('projects?tab=delivery&node=prepare')}>进入需求澄清 <ArrowRightOutlined /></Button></div></FrameworkCard></div> },
    ]} />
  </div>;
}

type AnalysisScope = 'single' | 'project';
const scopeLabels: Record<AnalysisScope, string> = { single: '单个需求', project: '项目多个需求' };
const sampleRequirements = [
  { id: 'DEMO-MKT-001', name: '白金卡消费返现', source: '本地交付记录', focus: '普通卡资格隔离、测试完成判定', sample: false },
  { id: 'SAMPLE-MKT-002', name: '奖励重复请求处理', source: '项目分析材料', focus: '重复请求与余额不变校验', sample: true },
  { id: 'SAMPLE-MKT-003', name: '活动资格与临界值', source: '项目分析材料', focus: '周期边界、金额精度与卡片等级', sample: true },
];
const findings = [
  { id: 'F-01', group: '业务 Skill', title: '把客户资格写进业务校验规则', text: '首次检查发现普通卡也进入返现路径。资格校验应先于返现计算，并分别覆盖白金卡与普通卡。', source: displayRequirementId('DEMO-MKT-001') + ' · E3 / E4 / E5', evidence: 'E4', kind: 'simulated' as const },
  { id: 'F-02', group: 'Agent 配置', title: '完成判定需要核对真实测试结果', text: '检查结果需同时保留输入、预期与实际值；资格用例未通过时不能仅凭流程完成认定交付成功。', source: displayRequirementId('DEMO-MKT-001') + ' · E3 / E5', evidence: 'E3', kind: 'simulated' as const },
  { id: 'F-03', group: '项目共性', title: '统一验证重复请求的处理结果', text: '关联材料要求同一交易不可重复写入；候选规则保留交易标识，并核对交易条数与欠款余额不变。', source: '分析材料 02 · 奖励重复请求处理', evidence: null, kind: 'simulated' as const },
  { id: 'F-04', group: '项目共性', title: '业务边界需要独立用例', text: '分析材料覆盖活动起止、正金额、四舍五入与重复请求。保留这些场景用于后续候选评估。', source: '分析材料 03 · 活动资格与临界值', evidence: null, kind: 'simulated' as const },
];

export function TalentSessions() {
  const { state, data, showEvidence, showText, update, busy, role } = useDemo();
  const [selectedScope, setScope] = useState<AnalysisScope>(state.workspace.analysis.scope);
  const owned = data.talent!.project;
  const locked = owned.evolution.status !== 'none';
  const scope = locked ? state.workspace.analysis.scope : selectedScope;
  const analyzed = owned.analysis.status === 'analyzed' && owned.analysis.scope === scope;
  const rows = scope === 'single' ? sampleRequirements.slice(0, 1) : sampleRequirements;
  const visibleFindings = scope === 'single' ? findings.slice(0, 2) : findings;
  if (data.talent!.context.id !== 'carddemo') return <FrameworkCard title={data.talent!.context.name + ' · 轨迹分析'}><Empty description="此项目尚无已上报的交付轨迹，分析保持空态。" /><Button href={teamsLink('projects?tab=delivery')}>返回项目交付</Button></FrameworkCard>;
  if (role !== 'owner') return <Alert type="info" title="轨迹分析由项目 Owner 管理" action={<Button href={talentLink('knowledge')}>查看项目知识</Button>} />;
  return <div className="page-stack talent-v2">
    <Heading eyebrow="TALENT / 轨迹分析与知识挖掘" title="从交付轨迹中提炼项目经验" description="选择一条需求定位具体问题，或汇总多条需求寻找可以复用的业务规则。" actions={<Button href={teamsLink('trace')}>查看 Teams 关联会话 <ArrowRightOutlined /></Button>} />
    <FrameworkCard title="分析范围"><div className="talent-analysis-toolbar"><Segmented aria-label="分析范围" value={scope} disabled={locked} onChange={value => setScope(value as AnalysisScope)} options={[{ label: '单个需求', value: 'single' }, { label: '项目多个需求', value: 'project' }]} /><Button type="primary" icon={<ExperimentOutlined />} data-workspace-action="analysis.run" loading={busy} disabled={!state.workspace.sessionReported || locked} onClick={() => void update('analysis.run', { scope })}>{analyzed ? '重新分析所选范围' : '开始轨迹分析'}</Button></div><Table size="middle" rowKey="id" pagination={false} scroll={{ x: 650 }} dataSource={rows} columns={[{ title: '需求', render: (_, row) => <div><strong>{row.name}</strong><small className="talent-table-sub">{row.sample ? '分析材料 ' + row.id.slice(-2) : displayRequirementId(row.id)}</small></div> }, { title: '分析关注点', dataIndex: 'focus' }, { title: '来源', render: (_, row) => <Tag color={row.sample ? 'default' : 'blue'}>{row.source}</Tag> }, { title: '依据', width: 100, render: (_, row) => <Button size="small" onClick={() => row.sample ? showText(row.name + ' · 分析材料', `该条目用于项目需求聚合分析。\n\n关注点：${row.focus}\n\n该材料尚未关联 iCode 会话，也没有模型评估报告。`) : showEvidence('E1')}>查看</Button> }]} /><p className="muted">分析结果来自本地交付记录和规则材料，不代表已执行外部模型评估。</p>{locked && <Alert type="info" title="分析范围已用于改进候选" description="当前候选、评估和发布保留相同的分析依据。" />}</FrameworkCard>
    {!state.workspace.sessionReported && <Alert type="warning" showIcon title="先在 Teams 上报交付相关会话" description="会话关联到项目和需求后，才能进入本次分析。" action={<Button href={teamsLink('trace')}>进入会话上报</Button>} />}
    <div className="metrics-row"><MiniStat label="所选需求" value={rows.length} note={scopeLabels[scope]} /><MiniStat label="关联记录" value={`${data.evidence.length} 条`} note="本地项目资料" /><MiniStat label="改进发现" value={analyzed ? visibleFindings.length : '待分析'} note="业务规则与执行策略" /><MiniStat label="分析状态" value={analyzed ? '已完成' : '待执行'} note={analyzed ? '分析结果已保存' : '确认范围后开始'} /></div>
    {analyzed && <Alert type="success" showIcon title={`已整理 ${visibleFindings.length} 项改进建议`} description="重点关注资格校验、金额边界和交付证据；详细依据可逐项展开核对。" />}
    {!analyzed ? <FrameworkCard title="分析结果"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={state.workspace.analysis.status === 'analyzed' ? '已切换分析范围，点击开始轨迹分析查看该范围的结果。' : '选择分析范围并开始分析，结果会保留到当前项目。'} /></FrameworkCard> : <Tabs items={[
      { key: 'findings', label: '发现与依据', children: <div className="page-stack"><div className="talent-rule-grid">{visibleFindings.map(f => <FrameworkCard key={f.id} title={f.id + ' · ' + f.group}><FileSearchOutlined className="knowledge-icon" /><h3>{f.title}</h3><p>{f.text}</p><small className="muted">{f.source}</small><div className="card-actions"><Button size="small" onClick={() => f.evidence ? showEvidence(f.evidence) : showText(f.source, f.text + '\n\n该发现来自项目分析材料，用于需求聚合分析。')}>查看发现依据</Button></div></FrameworkCard>)}</div><div className="talent-next"><div><strong>将发现转为可评估的改进</strong><p>业务规则进入 Skill 候选，执行与完成判定进入 Agent 配置候选。</p></div><Button type="primary" href={talentLink('evolution')}>进入能力演进 <ArrowRightOutlined /></Button></div></div> },
      { key: 'comparison', label: '需求对照', children: <FrameworkCard title={scope === 'single' ? '白金卡返现的失败与修复' : '项目多需求的共性与差异'}><Table size="middle" rowKey="dimension" pagination={false} scroll={{ x: 650 }} dataSource={[
        { dimension: '状态与动作', primary: '普通卡不得获得白金卡返现', second: '重复请求返回已有结果', third: '周期外与无效金额明确原因', conclusion: '每个业务状态都有可解释的下一步' },
        { dimension: '执行依据', primary: '保留失败、修复与复测记录', second: '保留交易标识与余额变化', third: '保留边界输入和预期值', conclusion: '每条结论可以回到具体输入与证据' },
        { dimension: '完成判定', primary: '检查内层测试结果与报告', second: '确认奖励仅入账一次', third: '确认受限状态不被误放行', conclusion: '按业务标准和检查结果分别判定' },
      ]} columns={[{ title: '维度', dataIndex: 'dimension', width: 110 }, { title: '白金卡返现 · 交付记录', dataIndex: 'primary' }, ...(scope === 'project' ? [{ title: '重复处理 · 分析材料', dataIndex: 'second' }, { title: '资格边界 · 分析材料', dataIndex: 'third' }] : []), { title: '挖掘结论', dataIndex: 'conclusion' }]} /></FrameworkCard> },
      { key: 'inputs', label: '会话与材料', children: <FrameworkCard title="分析输入与关联"><Descriptions column={1} size="small" items={[{ key: 'scope', label: '已保存范围', children: scopeLabels[state.workspace.analysis.scope] }, { key: 'session', label: '关联会话', children: <Mono>{data.blueprint.trace.session_id}</Mono> }, { key: 'request', label: '原始需求', children: data.blueprint.scenario.parent_requirement }, { key: 'report', label: 'Teams 上报状态', children: state.workspace.sessionReported ? '会话已上报' : '待上报' }, { key: 'version', label: '本次知识依据', children: state.context?.knowledgeVersion ?? 'knowledge-v1' }]} /><div className="card-actions"><Button href={teamsLink('trace')}>打开会话轨迹</Button><Button href={talentLink('knowledge')}>查看项目知识</Button><Button onClick={() => showEvidence('E3')}>查看失败检查</Button></div></FrameworkCard> },
    ]} />}
  </div>;
}

const evaluations = {
  skill: [
    { name: '普通卡不享受专属返现', before: '首次检查发现资格隔离缺失', after: '拦截普通卡，白金卡正常计算', source: 'E3 / E4 / E5', evidence: 'E4' },
    { name: '活动起止与卡片等级', before: '需要补充限制组合检查', after: '明确限制原因，保持不可参与', source: '保留用例', evidence: null },
    { name: '金额精度与重复处理', before: '需显式核对业务规则', after: '检查 0.5% 四舍五入与单次入账', source: '项目规则与保留用例', evidence: null },
  ],
  agent: [
    { name: '业务预期与检查结果不一致', before: '完成判定缺少强制核对', after: '阻止完成，报告失败依据', source: 'E3', evidence: 'E3' },
    { name: '报告缺失或结果不一致', before: '需补充报告一致性要求', after: '标记待验证，保留诊断信息', source: '保留用例', evidence: null },
    { name: '功能通过 / 安全尚未验证', before: '缺少分项完成判定要求', after: '功能进入验收，安全保持待验证', source: 'E5 与已知安全边界', evidence: 'E5' },
  ],
};

export function Evolution() {
  const { state, data, showEvidence, showText, role } = useDemo();
  const [candidate, setCandidate] = useState<'skill' | 'agent'>('skill');
  const owned = data.talent!.project;
  const exists = owned.evolution.status !== 'none';
  const evaluated = ['evaluated', 'published'].includes(owned.evolution.status);
  const published = owned.evolution.status === 'published';
  const analyzed = owned.analysis.status === 'analyzed';
  const ready = state.stage === 'accepted' && state.workspace.sessionReported && analyzed;
  const index = { none: 0, candidate: 1, evaluated: 2, published: 3, adopted: 3 }[owned.evolution.status];
  if (data.talent!.context.id !== 'carddemo') return <FrameworkCard title={data.talent!.context.name + ' · 能力演进'}><Empty description="此项目尚无经过分析的交付依据，演进候选保持空态。" /></FrameworkCard>;
  if (role !== 'owner') return <Alert type="info" title="能力演进由项目 Owner 管理" action={<Button href={talentLink('knowledge')}>查看项目知识</Button>} />;
  return <div className="page-stack talent-v2">
    <Heading eyebrow="TALENT / 能力演进" title="把交付经验转为下一次开发的能力" description="分别改进业务 Skill 与 Agent 配置定义，通过候选对照评估，再确认发布和采用。" />
    <div className="evolution-progress"><Steps size="small" current={index} items={[{ title: '分析依据' }, { title: '改进候选' }, { title: '对照评估' }, { title: '发布与采用' }]} /></div>
    <FrameworkCard title="本次改进来源" action={<Tag color={ready ? 'green' : 'gold'}>{ready ? '输入已就绪' : '等待前置流程'}</Tag>}><div className="talent-source-summary"><div><h3>{analyzed ? scopeLabels[state.workspace.analysis.scope] : '白金卡消费返现'} · 交付与分析</h3><StatusLine complete={state.stage === 'accepted'}>需求已通过 Owner 功能验收</StatusLine><StatusLine complete={state.workspace.sessionReported}>相关会话已关联并上报</StatusLine><StatusLine complete={analyzed}>已完成轨迹分析与知识挖掘</StatusLine><div className="card-actions"><Button size="small" onClick={() => showEvidence('E3')}>E3 失败</Button><Button size="small" onClick={() => showEvidence('E4')}>E4 修复</Button><Button size="small" onClick={() => showEvidence('E5')}>E5 复测</Button></div></div><ActionButton role="owner" action="candidate" disabled={!ready || exists}>{exists ? '改进候选已生成' : '生成 Skill 与 Agent 改进候选'}</ActionButton></div></FrameworkCard>
    {!exists ? <div className="talent-empty"><ExperimentOutlined /><h2>让改进有具体依据</h2><p>完成验收、会话上报与分析后，生成两类可以分别查看和评估的候选。</p><Space wrap><Button href={teamsLink('projects?tab=delivery&node=accept')}>查看业务验收</Button><Button type="primary" href={talentLink('sessions')}>进入轨迹分析</Button></Space></div> : <>
      <Tabs activeKey={candidate} onChange={value => setCandidate(value as 'skill' | 'agent')} items={[
        { key: 'skill', label: <span><BookOutlined /> 业务 Skill 候选</span>, children: <FrameworkCard title="白金卡返现业务规则" action={<Tag color="purple">dev-frontend-ui · 1.0.0 → 1.1.0</Tag>}><p>基于 dev-frontend-ui 补充白金卡返现规则，覆盖资格、周期、金额精度与重复处理。</p><div className="talent-diff"><div className="talent-diff-before"><small>当前版本 1.0.0</small><h3>通用页面实施指导</h3><p>页面实现、基本状态和交互处理。</p><ul><li>缺少白金卡与普通卡的资格矩阵</li><li>缺少返现边界与重复处理的场景清单</li></ul></div><div className="talent-diff-after"><small>候选版本 1.1.0</small><h3>增加白金卡返现业务附录</h3><ul><li>白金卡、普通卡及周期内外分别定义结果</li><li>核对额外 0.5%、金额精度与周期边界</li><li>重复请求核对同一交易与余额不变</li><li>每项规则关联测试输入、修复和复测证据</li></ul></div></div><div className="card-actions"><Button onClick={() => showText('业务 Skill 候选内容', displayTalentArtifact(owned.evolution.candidates.find(item=>item.kind==='skill')?.definition ?? 'Talent 记录缺少业务 Skill 候选正文，请检查服务产物。'))}>查看完整候选</Button><Button onClick={() => showEvidence('E4')}>查看改进依据</Button></div><p className="muted">候选版本基于 dev-frontend-ui，保存于 Talent；原始 Skill 文件保持原样。</p></FrameworkCard> },
        { key: 'agent', label: <span><RobotOutlined /> Agent 配置候选</span>, children: <FrameworkCard title="Code Agent · 完成判定与证据要求" action={<Tag color="blue">r1 → r2</Tag>}><p>把验证动作、工具使用要求和提交条件写入 Agent 配置定义，使每次交付保留可核对的完成依据。</p><div className="talent-diff"><div className="talent-diff-before"><small>当前配置 r1</small><h3>基础开发执行</h3><p>分析需求、修改代码、执行检查、汇总结果。</p><ul><li>业务预期与检查结果缺少强制核对</li><li>报告完整性与功能、安全结论缺少独立要求</li></ul></div><div className="talent-diff-after"><small>候选配置 r2</small><h3>按分项证据完成任务</h3><ul><li>保留被测进程退出码与结构化报告</li><li>缺报告或结论不一致时保持待验证</li><li>增加独立的业务动作可达性检查</li><li>分别提交功能、Review、安全及复测依据</li></ul></div></div><div className="card-actions"><Button onClick={() => showText('Code Agent r2 候选定义', displayTalentArtifact(owned.evolution.candidates.find(item=>item.kind==='agent')?.definition ?? 'Talent 记录缺少 Agent 候选正文，请检查服务产物。'))}>查看候选定义</Button><Button onClick={() => showEvidence('E3')}>查看测试判定问题</Button></div><p className="muted">r1 / r2 是当前 Agent 配置版本，与已冻结的作业上下文分别保存。</p></FrameworkCard> },
      ]} />
      <FrameworkCard title={candidate === 'skill' ? '业务 Skill 独立对照评估' : 'Agent 配置独立对照评估'}><p>{candidate === 'skill' ? '依据固定规则用例，对照业务 Skill 1.0.0 和候选 1.1.0。' : '依据固定规则用例，对照 Code Agent r1 和候选 r2。'}</p><Table size="middle" rowKey="name" pagination={false} scroll={{ x: 680 }} dataSource={evaluations[candidate]} columns={[{ title: '评估场景', dataIndex: 'name' }, { title: '基线', dataIndex: 'before' }, { title: '候选结果', render: (_, row) => evaluated ? <span className="talent-pass"><CheckCircleOutlined /> {row.after}</span> : <Tag>待评估</Tag> }, { title: '用例来源', render: (_, row) => row.evidence ? <Button type="link" size="small" onClick={() => showEvidence(row.evidence!)}>{row.source}</Button> : <span className="muted">{row.source}</span> }]} /><div className="card-actions"><ActionButton role="owner" action="evaluate" disabled={owned.evolution.status !== 'candidate'}>{evaluated ? '两组评估已完成' : '核对两组评估结果'}</ActionButton></div><p className="muted">数据来源：本地规则用例。外部模型评估尚未执行。</p></FrameworkCard>
      <FrameworkCard title="能力版本与项目采用"><div className="talent-version-grid"><div className="talent-version"><span>当前交付采用版本</span><strong>Skill {state.context?.skillVersion ?? '1.0.0'} · Agent {state.context?.agentVersion ?? 'r1'}</strong><p>CTX-MKT-001 保留原采用依据</p><Tag>作业上下文</Tag></div><div className="talent-version talent-version-next"><span>本次改进产物</span><strong>Skill 1.1.0 · Agent r2</strong><p>{published ? 'Talent 已确认发布' : evaluated ? '评估已完成，等待 Owner 发布' : '候选待评估'}</p><Tag color={published ? 'green' : 'gold'}>{state.evolution === 'adopted' ? 'Teams 已采用' : published ? '可供采用' : '候选版本'}</Tag></div></div><div className="talent-release-status"><StatusLine complete={exists}>生成两类候选并保留分析依据</StatusLine><StatusLine complete={evaluated}>完成 Skill 与 Agent 两组独立评估</StatusLine><StatusLine complete={published}>Owner 确认发布新版本</StatusLine><StatusLine complete={state.evolution === 'adopted'}>Teams 采用新版供后续需求使用</StatusLine></div><Space wrap><ActionButton action="release" role="owner" disabled={owned.evolution.status !== 'evaluated'}>{published ? 'Talent 新版本已发布' : 'Owner 确认发布新版本'}</ActionButton><Button type={published ? 'primary' : 'default'} disabled={!published} href={teamsLink('resources')}>在 Teams 中采用 <ArrowRightOutlined /></Button></Space></FrameworkCard>
    </>}
  </div>;
}
