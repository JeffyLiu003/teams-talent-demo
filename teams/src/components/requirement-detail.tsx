import { Button, Descriptions, Space } from 'antd';
import { useDemo } from '../context.js';
import { displayRequirementId, displayText } from '../display-text.js';
import type { OverviewRequirement } from '../project-overview.js';
import { currentMemberOwnsTask } from '../task-assignment.js';
import { TaskAssignment } from './task-assignment.js';
export const requirementPhaseLabel = (phase: string) => ({ '待开展': '待开始', '准备': '需求准备', '开发': '功能开发', '验证': '测试验证' }[phase] ?? phase);
export function RequirementDetail({ projectId, item }: { projectId: string; item: OverviewRequirement }) {
  const { state, role, navigate, showText } = useDemo();
  const local = projectId === 'carddemo' && item.taskId === 'DEMO-MKT-001';
  const stateLabel = local && !state.assigned ? '待分配' : requirementPhaseLabel(item.phase);
  const nextLabel = role === 'owner' ? item.phase === '待验收' ? '验收需求' : '查看交付进度' : local && currentMemberOwnsTask(state) ? ['assigned','draft'].includes(state.stage) ? '开始处理' : state.stage === 'accepted' ? '查看交付' : '继续处理' : '查看交付';
  const route = item.pendingConfirmation && local ? 'projects?project=carddemo&tab=delivery&node=prepare' : item.route;
  return <div className="page-stack requirement-detail">
    <p className="muted">来源：{item.source.origin==='teams-task'?'Teams':'需求平台'} · {displayRequirementId(item.taskId ?? item.source.sourceRecordId)}</p>
    <p>{displayText(item.source.summary)}</p>
    <Descriptions column={1} size="small" items={[
      { key: 'assignee', label: '交付人', children: <Space wrap>{item.owner}{local && state.assigned && <TaskAssignment secondary />}</Space> },
      { key: 'state', label: '当前状态', children: stateLabel },
      { key: 'due', label: '计划完成', children: item.due ?? '未排期' },
    ]} />
    {!local && item.source.origin!=='teams-task' && <p className="muted">{projectId === 'teams' ? '原项目任务记录只读，交付人和状态沿用来源。' : '此需求保留来源记录，尚未创建本地交付任务。'}</p>}
    <Space wrap>{local && !state.assigned && <TaskAssignment />}{route && (!local || state.assigned || role === 'member') && <Button type="primary" aria-label={nextLabel} onClick={() => navigate(route)}>{nextLabel}</Button>}<Button type="link" size="small" onClick={() => showText(item.source.title + ' · 来源原文', displayText(item.source.detail))}>查看来源</Button></Space>
  </div>;
}
