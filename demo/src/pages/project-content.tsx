import { useState } from 'react';
import { Button, Descriptions, Form, Input, Modal, Space, Tabs, Tag } from 'antd';
import { FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import { useDemo } from '../context.js';
import { FrameworkCard } from '../vendor/teams/components/page-layout.js';
import { ActionButton, Mono, Origin } from '../components/common.js';
import { stageLabels } from '../domain.js';
import { ProjectContentTemplate } from '../components/project-content-template.js';
import { ProjectAssets } from '../components/project-assets.js';
import { ProjectKnowledge } from '../components/project-knowledge.js';

export function ProjectContent() {
  const { state, data, role, navigate } = useDemo();
  return <ProjectContentTemplate projectId="carddemo" name={state.workspace.project.name} description={state.workspace.project.description} origin={<Origin kind="simulated" />}
    information={[
      { key: 'team', label: '所属团队', children: state.workspace.team.name }, { key: 'owner', label: '项目 Owner', children: '林悦' },
      { key: 'repository', label: '主仓', span: 2, children: <Mono>{state.workspace.project.repository}</Mono> },
      { key: 'directory', label: '本机目录', span: 2, children: 'carddemo-java-1025 · 通过顶部 iCode 作业入口核验本机路径' },
    ]}
    members={<><Descriptions size="small" column={1} items={[{ key: 'owner', label: '林悦 · 项目 Owner', children: '项目资产与知识、需求分配、质量能力、验收及演进' }, { key: 'member', label: '陈晨 · 项目成员', children: '需求上下文、开发、验证、交付与会话上报' }]} /><Button onClick={() => navigate('team')}>查看团队成员</Button></>}
    assets={<ProjectAssets projectId="carddemo" />}
    knowledge={<ProjectKnowledge projectId="carddemo" />}
    requirements={<><RequirementMaterials /><div className="card-actions"><Button type="primary" onClick={() => navigate('projects?tab=delivery&node=prepare')}>进入需求准备</Button></div></>}
    skills={data.skills.filter(skill => data.blueprint.skill_groups.some(group => group.skills.includes(skill.name))).map(skill => ({ ...skill, source: '项目采用的导入素材', displayPath: skill.path.slice(skill.path.indexOf('/workspace/') + 1), content: data.skillContents[skill.name] }))}
    skillFooter={<div className="project-skill-context"><div><strong>本次交付配置</strong><p>前端 Skill {state.adoptedSkill} · Code Agent {state.adoptedAgent} · Review / 测试 / 安全扫描分别保留依据</p><Tag color="green">项目内可用</Tag></div><Space wrap><Button type="primary" onClick={() => navigate('projects?tab=delivery&node=prepare')}>在需求准备中选用</Button><Button onClick={() => navigate('resources')}>查看共享能力</Button>{role === 'owner' && <Button onClick={() => navigate('connections?tab=quality')}>维护质量能力</Button>}</Space></div>}
  />;
}

export function RequirementMaterials() {
  const { state, role, update, busy, showText, showEvidence } = useDemo();
  const [adding, setAdding] = useState(false);
  const [form] = Form.useForm();
  return <><div className="project-material-list"><div className="project-material"><FileTextOutlined /><div><strong>信用卡营销原始需求</strong><small>iCode 历史会话 · E1</small></div><Button size="small" onClick={() => showEvidence('E1')}>查看</Button></div>
    {state.workspace.materials.map(material => <div className="project-material" key={material.id}><FileTextOutlined /><div><strong>{material.title}</strong><small>成员补充 · 本次需求</small></div><Button size="small" onClick={() => showText(material.title, material.body)}>查看</Button></div>)}</div>
    {role === 'member' && <Button className="project-material-add" icon={<PlusOutlined />} disabled={!!state.context} onClick={() => setAdding(true)}>补充需求材料</Button>}
    {state.context && <p className="muted">本次上下文已冻结，材料与业务 Skill 保留采用时的版本。</p>}
    <Modal open={adding} title="补充需求材料" okText="保存到需求" onCancel={() => setAdding(false)} confirmLoading={busy} onOk={() => form.submit()} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={async value => { await update('material.add', value); form.resetFields(); setAdding(false); }}>
        <Form.Item name="title" label="材料标题" rules={[{ required: true, whitespace: true }]}><Input maxLength={120} placeholder="例如：餐饮返现边界补充" /></Form.Item>
        <Form.Item name="body" label="内容与来源" rules={[{ required: true, whitespace: true }]}><Input.TextArea rows={6} maxLength={5000} placeholder="说明本需求的业务规则、补充资料或来源引用" /></Form.Item>
      </Form>
    </Modal>
  </>;
}

export function ProjectManagement() {
  const { state, data, role, navigate, showEvidence } = useDemo();
  return <div className="page-stack"><Tabs defaultActiveKey="tasks" items={[
    { key: 'sources', label: '信息收集', children: <FrameworkCard title="需求来源与补充材料"><RequirementMaterials /></FrameworkCard> },
    { key: 'discussion', label: '任务讨论', children: <FrameworkCard title="本次采用的需求约定"><p>在存量信用卡系统中增加餐饮消费返现：先报名，满足条件后发放奖励，重复请求不重复入账。</p><Descriptions column={1} items={[{ key: 'scope', label: '范围', children: '活动中心报名入口、营销评估、奖励发放、账户入账和异常重试' }, { key: 'baseline', label: '本次标准', children: '需求修订 1 · 首刷礼已领取，本次只观察餐饮返现' }]} /><Button onClick={() => showEvidence('E1')}>查看原始需求</Button><div className="project-criteria">{data.blueprint.acceptance_criteria.map(item => <div key={item.id}><Tag>{item.id}</Tag><p><strong>{item.given}</strong><br />{item.expected}</p></div>)}</div></FrameworkCard> },
    { key: 'tasks', label: '任务列表', children: <FrameworkCard title="餐饮消费返现" action={<Tag color={state.stage === 'accepted' ? 'green' : 'purple'}>{stageLabels[state.stage]}</Tag>}><Descriptions size="small" column={2} items={[{ key: 'id', label: '任务', children: 'DEMO-MKT-001' }, { key: 'owner', label: '负责人', children: '陈晨 · 项目成员' }, { key: 'confirmer', label: '确认人', children: '林悦 · 项目 Owner' }, { key: 'release', label: '交付范围', children: '信用卡营销 · v0.1 演示' }]} /><p>报名餐饮活动后消费 120 元，获得 6 元返现；重复评估仍只产生一笔奖励。</p><Space wrap>{role === 'owner' && <ActionButton action="assign" role="owner" disabled={state.assigned}>{state.assigned ? '需求已分配给陈晨' : '确认需求并分配给成员'}</ActionButton>}<Button type="primary" onClick={() => navigate('projects?tab=delivery&node=prepare')}>进入任务交付</Button><Button onClick={() => navigate('trace')}>查看任务依据</Button></Space></FrameworkCard> },
  ]} /></div>;
}

export function ProjectRelease() {
  const { state, navigate } = useDemo();
  return <div className="page-stack"><FrameworkCard title="信用卡营销 · v0.1" action={<Tag color={state.stage === 'accepted' ? 'green' : 'gold'}>{state.stage === 'accepted' ? '功能交付已确认' : '交付准备中'}</Tag>}><Descriptions column={1} items={[{ key: 'scope', label: '版本范围', children: '餐饮消费返现 · DEMO-MKT-001' }, { key: 'result', label: '交付状态', children: stageLabels[state.stage] }, { key: 'safety', label: '安全要求', children: <Tag color="gold">待验证</Tag> }, { key: 'release', label: '发布事实', children: '当前未登记部署或上线记录' }]} /><p>本页汇总需求归属、交付成果和验收结论。功能验收后仍可回到原始交付依据。</p><Space wrap><Button type="primary" onClick={() => navigate('projects?tab=delivery&node=accept')}>查看交付与验收</Button><Button onClick={() => navigate('trace')}>查看完整追溯</Button></Space></FrameworkCard></div>;
}

export function ProjectSettings() {
  const { state, role, update, busy, navigate } = useDemo();
  return <div className="page-stack"><FrameworkCard title="项目基础信息"><Form key={state.workspace.project.name + state.workspace.project.repository} layout="vertical" initialValues={state.workspace.project} disabled={role !== 'owner'} onFinish={value => update('project.update', value)}>
    <Form.Item name="name" label="项目名称" rules={[{ required: true, whitespace: true }]}><Input maxLength={80} /></Form.Item><Form.Item name="description" label="项目说明" rules={[{ required: true, whitespace: true }]}><Input.TextArea rows={3} maxLength={1000} /></Form.Item><Form.Item name="repository" label="主仓地址或路径" rules={[{ required: true, whitespace: true }]}><Input maxLength={200} /></Form.Item>{role === 'owner' && <Button type="primary" htmlType="submit" loading={busy}>保存项目信息</Button>}
  </Form></FrameworkCard><FrameworkCard title="项目成员与职责" action={<Origin kind="simulated" />}><Descriptions size="small" items={[{ key: 'team', label: '所属团队', children: state.workspace.team.name }, { key: 'stage', label: '项目阶段', children: stageLabels[state.stage] }]} /><Descriptions bordered column={1} items={[{ key: 'owner', label: '林悦 · 项目 Owner', children: '项目资产与知识、需求分配、质量能力、验收及演进' }, { key: 'member', label: '陈晨 · 项目成员', children: '需求上下文、开发、验证、交付与会话上报' }]} /><Button onClick={() => navigate('team')}>查看团队成员</Button></FrameworkCard></div>;
}
