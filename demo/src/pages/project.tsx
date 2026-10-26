import { displayProjectDescription, displayText } from '../display-text.js';
import { Alert, Button, Descriptions, Space, Tag } from 'antd';
import { ArrowLeftOutlined, FileTextOutlined, SettingOutlined } from '@ant-design/icons';
import { useDemo } from '../context.js';
import { Heading } from '../components/common.js';
import { ProjectToolbar } from '../components/project-toolbar.js';
import { stageLabels } from '../domain.js';
import { FrameworkCard } from '../vendor/teams/components/page-layout.js';
import { ProjectWorkLaunch } from '../components/project-work-launch.js';
import { TeamsProjectCard } from './teams-project.js';
import { CreateProjectButton, CreatedProjectCard } from './created-project.js';
import { ProjectContent, ProjectManagement, ProjectRelease, ProjectSettings } from './project-content.js';
import { ProjectDelivery, nodeLabels, type DeliveryNode } from './project-delivery.js';
import '../project.css';

export function Project({ tab = 'content', node }: { tab?: string; node?: string }) {
  const { state, role, navigate } = useDemo();
  if (tab === 'list') return <div className="page-stack project-workspace"><Heading eyebrow="团队空间" title="项目" description={role === 'owner' ? '准备项目资产与知识，组织需求交付并确认成果。' : '进入参与的项目，准备需求上下文并开展开发。'} actions={role === 'owner' ? <CreateProjectButton /> : undefined} />
    <FrameworkCard title={state.workspace.project.name} action={<Tag color={state.stage === 'accepted' ? 'green' : 'purple'}>{stageLabels[state.stage]}</Tag>}><p>{displayText(displayProjectDescription(state.workspace.project.description))}</p><Descriptions size="small" column={2} items={[{ key: 'team', label: '所属团队', children: state.workspace.team.name }, { key: 'people', label: '协作角色', children: 'Owner 林悦 · 成员 陈晨' }, { key: 'repository', label: '主仓', children: state.workspace.project.repository }, { key: 'task', label: '本次需求', children: '信用卡消费返现 · MKT-001' }]} /><Space wrap><Button type="primary" onClick={() => navigate('projects?tab=content')}>进入项目</Button><Button onClick={() => navigate('projects?tab=management')}>任务管理</Button><Button onClick={() => navigate('projects?tab=delivery&node=prepare')}>任务交付</Button>{role === 'owner' && <Button onClick={() => navigate('projects?tab=settings')}>编辑项目</Button>}</Space></FrameworkCard>
    <TeamsProjectCard />
    {(state.workspace.projects ?? []).map(project => <CreatedProjectCard key={project.id} project={project} />)}
  </div>;
  const legacy = tab === 'requirement' ? 'management' : ['context', 'acceptance'].includes(tab) ? 'delivery' : tab;
  const selectedNode: DeliveryNode = tab === 'context' ? 'prepare' : tab === 'acceptance' ? 'accept' : node && Object.hasOwn(nodeLabels, node) ? node as DeliveryNode : ['submitted', 'accepted'].includes(state.stage) ? 'accept' : ['failed', 'fixed'].includes(state.stage) ? 'verify' : ['developing', 'returned'].includes(state.stage) ? 'develop' : 'prepare';
  return <div className="page-stack project-workspace project-detail">
    <ProjectToolbar activeKey={legacy} onChange={value => navigate('projects?tab=' + value)} actions={<>
      <Button type="text" icon={<FileTextOutlined />} aria-label="查看需求执行记录" title="查看需求执行记录" onClick={() => navigate('trace')}><span className="project-secondary-action-label">执行记录</span></Button>
      <Button type="text" icon={<SettingOutlined />} aria-label="项目设置" title="项目设置" onClick={() => navigate('projects?tab=settings')}><span className="project-secondary-action-label">项目设置</span></Button>
      <ProjectWorkLaunch target={{ projectId: 'carddemo', tab: legacy, ...(legacy === 'delivery' ? { taskId: 'DEMO-MKT-001', nodeId: selectedNode } : {}) }} />
    </>} />
    {legacy === 'content' ? <ProjectContent /> : legacy === 'management' ? <ProjectManagement /> : legacy === 'delivery' ? <ProjectDelivery node={selectedNode} /> : legacy === 'release' ? <ProjectRelease /> : legacy === 'settings' ? <><Button className="self-start" icon={<ArrowLeftOutlined />} onClick={() => navigate('projects?tab=content')}>返回项目内容</Button><ProjectSettings /></> : <Alert type="error" title="项目页面不存在" action={<Button onClick={() => navigate('projects?tab=content')}>进入项目内容</Button>} />}

  </div>;
}
