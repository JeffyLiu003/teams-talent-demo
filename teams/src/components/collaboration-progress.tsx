import { displayRequirementId } from '../display-text.js';
import { Button, Empty, Tag, Timeline } from 'antd';
import { useDemo } from '../context.js';
import { FrameworkCard } from '../vendor/teams/components/page-layout.js';

const phases = { started: '已开始', progress: '进展', blocked: '阻塞', result: '成果待确认' };
export function CollaborationProgress({ projectId, taskId }: { projectId: string; taskId: string }) {
  const { state, showText } = useDemo();
  const events = (state.workspace.collaboration?.events ?? []).filter(event => event.projectId === projectId && event.taskId === taskId);
  return <FrameworkCard title="Teams CLI 协作回传" action={<Tag>本机接入</Tag>}>
    {events.length ? <Timeline items={events.map(event => ({ key: event.id, color: event.phase === 'blocked' ? 'orange' : 'blue', content: <div>
      <p><Tag>{phases[event.phase]}</Tag><strong>{event.summary}</strong></p>
      {event.blocker && <p>阻塞：{event.blocker}</p>}
      <p className="muted">{displayRequirementId(event.taskId ?? '项目级')} · {event.nodeId} · {new Date(event.at).toLocaleString('zh-CN')}</p>
      <Button type="link" size="small" onClick={() => showText('协作回执 · ' + event.operationId, JSON.stringify(event, null, 2))}>查看会话、操作与证据引用</Button>
    </div> }))} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚无此任务的 CLI 回传" />}
    <p className="muted">回传记录绑定项目、任务、节点与 run/session。成员成果等待确认；质量检查、安全结论与 Owner 验收保持原流程。</p>
  </FrameworkCard>;
}
