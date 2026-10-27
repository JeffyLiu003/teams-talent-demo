import { projectMembers } from '../teams-domain.js';
import { useState } from 'react';
import { Alert, Button, Modal, Select } from 'antd';
import { useDemo } from '../context.js';
import { taskAssigneeId, taskAssigneeName } from '../task-assignment.js';
export function TaskAssignment({ secondary = false }: { secondary?: boolean }) {
  const { state, role, busy, perform } = useDemo();
  const [open, setOpen] = useState(false), [assigneeId, setAssigneeId] = useState<string>(), [failed, setFailed] = useState(false);
  if (role !== 'owner' || state.stage === 'accepted') return null;
  const members = projectMembers(state, 'carddemo').filter(member => member.status === 'active' && member.role === 'member');
  return <><Button type={secondary ? "link" : "primary"} size={secondary ? "small" : "middle"} aria-label={state.assigned ? '调整交付人' : '分配交付人'} onClick={() => { setAssigneeId(taskAssigneeId(state) ?? undefined); setFailed(false); setOpen(true); }}>{state.assigned ? '调整交付人' : '分配交付人'}</Button>
    <Modal title={state.assigned ? '调整需求交付人' : '确认需求并分配'} open={open} onCancel={() => setOpen(false)} closable={!busy} maskClosable={!busy} okText="确认分配" cancelText="取消" okButtonProps={{ 'aria-label': '确认分配需求', disabled: busy || !assigneeId || state.assigned && assigneeId === taskAssigneeId(state) }} cancelButtonProps={{ disabled: busy }} confirmLoading={busy} onOk={async () => { if (!assigneeId || busy) return; setFailed(false); if (await perform('assign', undefined, assigneeId)) setOpen(false); else setFailed(true); }}>
      <p>信用卡消费返现 · MKT-001</p><p className="muted">{state.assigned ? '当前交付人：' + taskAssigneeName(state) + '。调整后保留当前上下文、进度、成果及会话记录。' : '确认需求范围后，选择负责开发、验证与交付的成员。'}Owner 林悦继续负责验收。</p>
      <label htmlFor="requirement-assignee">交付人</label><Select id="requirement-assignee" aria-label="选择需求交付人" style={{ width: '100%', marginTop: 8 }} placeholder="请选择有效项目成员" value={assigneeId} disabled={busy} options={members.map(member => ({ value: member.id, label: member.name }))} onChange={setAssigneeId} />
      {failed && <Alert type="error" title="分配未保存，请核对错误提示。" />}
    </Modal>
  </>;
}
