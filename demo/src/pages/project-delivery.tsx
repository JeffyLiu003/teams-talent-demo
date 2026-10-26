import { CollaborationProgress } from '../components/collaboration-progress.js';
import { useState } from 'react';
import { Alert, Button, Descriptions, Drawer, Input, Select, Space, Tag, Timeline } from 'antd';
import { ArrowRightOutlined, CheckCircleOutlined, CloseOutlined, CodeOutlined, FileTextOutlined, ReloadOutlined } from '@ant-design/icons';
import { useDemo } from '../context.js';
import { FrameworkCard } from '../vendor/teams/components/page-layout.js';
import { ActionButton, Mono, Origin, StatusLine, talentLink } from '../components/common.js';
import { userSkillExamples } from '../project-skill-examples.js';
import { stageLabels } from '../domain.js';
import { RequirementMaterials } from './project-content.js';
import { ProjectAcceptance } from './project-acceptance.js';

export type DeliveryNode = 'prepare' | 'develop' | 'verify' | 'accept';
export const nodeLabels: Record<DeliveryNode, string> = { prepare: '需求准备', develop: '开发', verify: '验证', accept: '验收' };
const nodes = Object.keys(nodeLabels) as DeliveryNode[];

function TaskBackground() {
  const { data, showEvidence } = useDemo();
  return <div className="project-task-background"><h3>餐饮消费返现</h3><Tag>DEMO-MKT-001</Tag><p className="muted">负责人 陈晨 · 确认人 林悦</p><h4>任务目标</h4><p>持卡人报名后，符合条件的餐饮消费自动获得返现，奖励冲减账户欠款。</p><h4>范围</h4><p>报名入口、资格判断、奖励发放、账户入账、重复评估与异常重试。</p><h4>来源与背景</h4><Button size="small" type="link" onClick={() => showEvidence('E1')}>查看历史需求 E1</Button><p>固定演示卡尾号 9900，首刷礼已领取；本次只观察餐饮返现。</p><h4>交付标准</h4>{data.blueprint.acceptance_criteria.map(item => <div className="project-criterion" key={item.id}><Tag>{item.id}</Tag><strong>{item.given}</strong><p>{item.expected}</p></div>)}</div>;
}

export function ProjectDelivery({ node }: { node: DeliveryNode }) {
  const { state, navigate } = useDemo();
  const [details, setDetails] = useState(true), [background, setBackground] = useState(false);
  const complete = { prepare: !!state.context, develop: ['fixed', 'submitted', 'accepted'].includes(state.stage), verify: state.checks === 'passed', accept: state.stage === 'accepted' };
  return <div className={'project-delivery-layout' + (!details ? ' without-background' : '')}>
    <aside className="project-task-list"><div className="project-column-title">交付任务 <Tag>1</Tag></div><button className="project-selected-task" onClick={() => navigate('projects?tab=delivery&node=' + node)}><small>DEMO-MKT-001</small><strong>餐饮消费返现</strong><Tag color={state.stage === 'accepted' ? 'green' : 'purple'}>{stageLabels[state.stage]}</Tag><span>负责人 · 陈晨</span></button><p className="muted">需求、开发、检查和确认沿同一任务关联。</p></aside>
    <main className="project-node-main"><div className="project-flow-heading"><div><strong>任务交付流程</strong><p>需求修订 1 · 四节点演示模板</p></div><Button size="small" icon={<FileTextOutlined />} onClick={() => window.innerWidth < 1250 ? setBackground(true) : setDetails(!details)}>{details ? '任务资料' : '展开任务资料'}</Button></div>
      <div className="project-node-graph" aria-label="任务交付节点">{nodes.map((item, i) => <div key={item} className="project-flow-step"><button aria-label={'节点：' + nodeLabels[item]} aria-current={node === item ? 'step' : undefined} className={'project-flow-node' + (node === item ? ' selected' : '') + (complete[item] ? ' complete' : '')} onClick={() => navigate('projects?tab=delivery&node=' + item)}><span>{complete[item] ? <CheckCircleOutlined /> : String(i + 1).padStart(2, '0')}</span><strong>{nodeLabels[item]}</strong><small>{complete[item] ? '已完成' : item === 'verify' && state.checks === 'failed' ? '待修复' : '待处理'}</small></button>{i < 3 && <ArrowRightOutlined />}</div>)}</div>
      <div className="project-node-heading"><h2>{nodeLabels[node]}</h2><Tag>{node === 'accept' ? '确认人 · 林悦' : '负责人 · 陈晨'}</Tag></div>
      <div className="page-stack project-node-content">{node === 'prepare' ? <PrepareNode /> : node === 'develop' ? <DevelopNode /> : node === 'verify' ? <VerifyNode /> : <><ProjectAcceptance /><SessionReport /></>}</div>
    </main>
    {details && <aside className="project-task-context"><div className="project-column-title">任务资料<Button type="text" size="small" aria-label="收起任务资料" icon={<CloseOutlined />} onClick={() => setDetails(false)} /></div><TaskBackground /></aside>}
    <Drawer title="任务资料与交付标准" width={430} open={background} onClose={() => setBackground(false)}><TaskBackground /></Drawer>
  </div>;
}

function PrepareNode() {
  const { state, data, role, update, busy, showText, navigate } = useDemo();
  const frozen = !!state.context;
  return <>
    <FrameworkCard title="输入与采用依据" action={<Origin kind="simulated" />}><Descriptions size="small" column={1} items={[{ key: 'requirement', label: '需求', children: 'DEMO-MKT-001 · 修订 1' }, { key: 'knowledge', label: '项目知识', children: state.knowledge ? <Tag color="green">knowledge-v1 已就绪</Tag> : <Tag color="gold">等待 Owner 发起整合</Tag> }, { key: 'agent', label: 'Agent', children: 'Code Agent ' + (state.context?.agentVersion ?? state.adoptedAgent) }, { key: 'scope', label: '业务范围', children: '报名 / 餐饮返现 / 去重 / 异常重试' }]} /><Space wrap><Button href={talentLink('knowledge')}>查看项目知识</Button><Button onClick={() => navigate('projects?tab=content')}>查看项目资产</Button></Space></FrameworkCard>
    <FrameworkCard title="需求补充材料"><RequirementMaterials /></FrameworkCard>
    <FrameworkCard title="本次采用的 Skill" action={<Tag>{state.workspace.selectedSkills.length} 项{frozen ? '已冻结' : '已选'}</Tag>}><p>按本需求选择项目 Skill 或用户 Skill，查看内容后与上下文一起采用。</p><Select aria-label="选择业务 Skill" mode="multiple" className="project-skill-select" value={state.workspace.selectedSkills} disabled={role !== 'member' || frozen || busy} options={[{ label: '项目 Skill', options: data.skills.filter(skill => data.blueprint.skill_groups.some(group => group.skills.includes(skill.name))).map(skill => ({ label: skill.name, value: skill.name })) }, { label: '用户 Skill · 演示示例', options: userSkillExamples.map(skill => ({ label: skill.name, value: skill.id })) }]} onChange={skills => void update('skills.select', { skills })} placeholder="选择本需求需要的业务 Skill" optionFilterProp="label" /><div className="skill-pills">{state.workspace.selectedSkills.map(name => <button key={name} onClick={() => showText(name, data.skillContents[name] ?? userSkillExamples.find(skill => skill.id === name)?.content ?? data.skills.find(skill => skill.name === name)?.description ?? name)}>{name}</button>)}</div><p className="muted">项目和用户已有 Skill 可直接选用；用户 Skill 为预置示例，实际发现与加载由当前工具会话确认。</p><Button size="small" onClick={()=>navigate('projects?tab=content')}>查看项目与用户 Skill</Button></FrameworkCard>
    <FrameworkCard title="确认采用并进入开发" action={<Tag color={frozen ? 'green' : 'default'}>{frozen ? '已冻结' : '待采用'}</Tag>}><StatusLine complete={state.assigned}>需求已分配给陈晨</StatusLine><StatusLine complete={state.workspace.selectedSkills.length > 0}>已选择可用 Skill · Code Agent 已就绪</StatusLine><StatusLine complete={state.knowledge}>项目知识已就绪</StatusLine><StatusLine complete={frozen}>需求材料与业务 Skill 已冻结</StatusLine>{state.context && <p><Mono>{state.context.id}</Mono> · Skill {state.context.skillVersion} / Agent {state.context.agentVersion}</p>}<Space wrap><ActionButton action="prepare" role="member" disabled={!state.knowledge || !state.assigned || !state.workspace.selectedSkills.length || frozen}>{frozen ? '上下文已冻结' : '采用能力并冻结上下文'}</ActionButton><Button disabled={!frozen} onClick={() => navigate('projects?tab=delivery&node=develop')}>进入开发节点</Button></Space><p className="muted">顶部「iCode 作业」用于启动或继续原生会话，并导出上下文供 iCode 显式读取。</p></FrameworkCard>
  </>;
}

function DevelopNode() {
  const { state, role, update, busy, navigate, showEvidence } = useDemo();
  const [progress, setProgress] = useState('已完成餐饮返现的需求影响分析，正在核对报名入口与奖励去重逻辑。');
  const started = !!state.context && !['draft', 'assigned'].includes(state.stage);
  const canSync = !!state.context && ['developing', 'failed', 'fixed', 'returned'].includes(state.stage) && state.workspace.foundation.progressEnabled;
  return <>
    {!state.context && <Alert type="info" title="先确认采用需求上下文" action={<Button onClick={() => navigate('projects?tab=delivery&node=prepare')}>进入需求准备</Button>} />}
    {state.stage === 'returned' && <Alert type="warning" title="Owner 要求补充" description={state.returnReason} />}
    <FrameworkCard title="关联 iCode 作业" action={<Origin kind="historical" />}><p>餐饮消费返现 · COBOL 系统迁移 Java 微服务历史会话</p><p>在顶部「iCode 作业」进入真实工具；下面的回放推进本次演示状态。</p><Space wrap><ActionButton action="replay" role="member" disabled={!state.context || state.stage !== 'assigned'}>开始历史开发回放</ActionButton><Button onClick={() => navigate('trace')}>查看关联会话</Button></Space></FrameworkCard>
    <CollaborationProgress projectId="carddemo" taskId="DEMO-MKT-001" /><FrameworkCard title="工作进展与协作问题" action={<Origin kind="simulated" />}>{state.workspace.progress.length ? <Timeline items={state.workspace.progress.map(item => ({ key: item.id, content: <><p>{item.text}</p><small className="muted">iCode 同步演示 · {new Date(item.at).toLocaleString('zh-CN')} · {item.node}</small></> }))} /> : <p className="muted">尚无进度同步记录。开始开发后，可以演示一次 iCode → Teams 进度回传。</p>}{role === 'member' && <><Input.TextArea aria-label="同步开发进度" rows={3} value={progress} onChange={event => setProgress(event.target.value)} maxLength={1000} disabled={!canSync} /><div className="card-actions"><Button loading={busy} disabled={!canSync || !progress.trim()} onClick={() => void update('progress.sync', { text: progress, node: 'develop' })}>模拟 iCode 同步进度</Button></div></>}{!state.workspace.foundation.progressEnabled && <Alert type="info" title="进度同步尚未启用" description="团队协作进度同步开关已关闭。" />}<p className="muted">此处按钮保存手工演示记录；上方展示 Teams CLI 实际 HTTP 回传。</p></FrameworkCard>
    <FrameworkCard title="成果与附件"><div className="project-artifact"><CodeOutlined /><div><strong>app.js · offerCard</strong><p>报名入口与资格判断调整，关联失败、修复和复测记录。</p></div><Button size="small" onClick={() => showEvidence('E4')}>查看历史变更</Button></div><Space wrap><Button type="primary" disabled={!started} onClick={() => navigate('projects?tab=delivery&node=verify')}>进入验证节点</Button><Button onClick={() => navigate('trace')}>查看执行证据</Button></Space></FrameworkCard>
  </>;
}

function VerifyNode() {
  const { state, role, navigate, showEvidence } = useDemo();
  const [replay, setReplay] = useState(false);
  const passed = state.checks === 'passed';
  return <>
    <Alert type="info" title="质量报告由 iCode 执行后回流" description="Teams 在此汇总检视、测试和扫描结果。当前展示历史测试证据和静态问题，安全扫描报告仍待提供。" />
    <FrameworkCard title="本次检查范围"><Descriptions size="small" column={1} items={[{ key: 'requirement', label: '需求', children: 'DEMO-MKT-001' }, { key: 'change', label: '变更', children: '活动报名入口 · app.js / offerCard' }, { key: 'source', label: '版本依据', children: '历史 before / after 文件摘要，完整值见追溯' }]} />{role === 'owner' && <Button onClick={() => navigate('organization')}>查看组织质量能力</Button>}</FrameworkCard>
    <div className="project-quality-reports">
      <FrameworkCard title="Code Review" action={<Origin kind="static" />}><Tag color="gold">1 项待核验</Tag><p>营销评估的实际事务调用边界与设计约定需要进一步核验。</p><Button onClick={() => navigate('trace?evidence=security')}>查看问题依据</Button></FrameworkCard>
      <FrameworkCard title="测试与复测" action={<Origin kind="historical" />}><Tag color={passed ? 'green' : state.checks === 'failed' ? 'red' : 'default'}>{passed ? '9 / 9 通过' : state.checks === 'failed' ? '7 / 8 · 待修复' : '待回放检查'}</Tag><p>{passed ? '报名入口修复后历史复测通过，退出码 EXIT:0。' : '历史检查发现未报名时没有“立即报名”入口，退出码 EXIT:1。'}</p><Button disabled={state.checks === 'none'} onClick={() => showEvidence(passed ? 'E5' : 'E3')}>查看原始测试报告</Button></FrameworkCard>
      <FrameworkCard title="安全扫描" action={<Tag color="gold">待验证</Tag>}><p>素材缺少扫描引擎产出的真实报告。鉴权范围与待验证事项继续纳入交付。</p><Button onClick={() => navigate('trace?evidence=security')}>查看安全依据</Button></FrameworkCard>
    </div>
    <FrameworkCard title="问题、修复与复测"><div className="project-evidence-sequence"><Button onClick={() => showEvidence('E3')}>E3 首次失败</Button><ArrowRightOutlined /><Button onClick={() => showEvidence('E4')}>E4 修复变更</Button><ArrowRightOutlined /><Button onClick={() => showEvidence('E5')}>E5 复测通过</Button></div><p>needsEnrollment 将“需要报名”与最终资格判断分开，使用户能够先完成报名动作。</p>{role === 'member' && <Button icon={<ReloadOutlined />} onClick={() => setReplay(true)}>打开 iCode 执行回放</Button>}</FrameworkCard>
    <FrameworkCard title="提交交付结果"><p>交付包包含冻结上下文、代码变更、检查与复测证据，以及未解决的安全与事务事项。</p><Space wrap><ActionButton action="submit" role="member" disabled={state.stage !== 'fixed' || !passed}>{['submitted', 'accepted'].includes(state.stage) ? '交付包已提交' : '提交交付包'}</ActionButton><Button disabled={!['submitted', 'accepted'].includes(state.stage)} onClick={() => navigate('projects?tab=delivery&node=accept')}>进入 Owner 验收</Button></Space></FrameworkCard>
    <SessionReport />
    <Drawer width={620} title="iCode 执行回放" open={replay} onClose={() => setReplay(false)}><div className="page-stack"><Alert type="info" showIcon title="历史开发过程回放" description="这些按钮推进模拟任务状态并引用原始执行证据。本轮不重新执行真实测试，也不生成扫描通过结论。" /><FrameworkCard title="首次检查"><p>E3 · 7/8 · 报名入口不可达 · EXIT:1</p><ActionButton action="check-fail" role="member" disabled={state.stage !== 'developing'}>回放首次检查 · 发现缺陷</ActionButton></FrameworkCard><FrameworkCard title="修复并复测"><p>E4 修改报名判断，E5 复测 9/9 · EXIT:0。</p><ActionButton action="fix" role="member" disabled={!['failed', 'returned'].includes(state.stage)}>应用历史修复并复测</ActionButton></FrameworkCard><Button onClick={() => setReplay(false)}>返回 Teams 质量报告</Button></div></Drawer>
  </>;
}

function SessionReport() {
  const { state, role, update, busy, navigate } = useDemo();
  return <FrameworkCard title="会话上报与交付追溯" action={<Tag color={state.workspace.sessionReported ? 'green' : 'default'}>{state.workspace.sessionReported ? '已上报（演示）' : '待成员上报'}</Tag>}><p>成员提交交付包后，将关联会话上报至 Teams；Owner 可继续查看执行记录并进入 Talent 分析。</p><Space wrap>{role === 'member' && <Button loading={busy} disabled={!['submitted', 'accepted'].includes(state.stage) || state.workspace.sessionReported || !state.workspace.foundation.uploadEnabled} onClick={() => void update('session.report', {})}>上报关联会话</Button>}<Button onClick={() => navigate('trace')}>查看会话与上报状态</Button></Space>{!state.workspace.foundation.uploadEnabled && !state.workspace.sessionReported && <Alert type="info" title="会话上报尚未启用" />}{state.stage === 'accepted' && !state.workspace.sessionReported && <p className="muted">功能验收已完成，下一步请由成员上报会话。</p>}</FrameworkCard>;
}
