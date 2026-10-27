import { displayText, displayRequirementId } from '../display-text.js';
import { useEffect, useState } from 'react';
import { Alert, Button, Collapse, Descriptions, Input, Modal, Radio, Space, Spin, Tooltip, Typography } from 'antd';
import { CodeOutlined } from '@ant-design/icons';
import { useDemo } from '../context.js';
import { bindProjectWork, getProjectWork, startProjectWork } from '../api.js';
import type { ProjectWorkAction, ProjectWorkPlan, ProjectWorkReceipt, ProjectWorkSelection } from '../project-work.js';
import { ConfirmWork } from '../vendor/teams/work/confirm-work.js';
import { projectDeliveryTasks } from '../project-delivery-tasks.js';
import { projectTasksVisibleTo, taskExecutableBy } from '../task-visibility.js';
import './project-work-launch.css';

const requestPending = (receipt?: ProjectWorkReceipt) => receipt?.status === 'uncertain' || receipt?.status === 'prepared';
const requestTime = (value: string) => {
  const at = new Date(value);
  return Number.isNaN(at.valueOf()) ? '时间待核对' : at.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
};

function WorkResult({ plan, receipt, done, newWork, inspect, check }: {
  plan: ProjectWorkPlan; receipt: ProjectWorkReceipt; done: () => void; newWork: () => void; inspect: () => void; check: () => void;
}) {
  const pending = requestPending(receipt);
  const focused = receipt.status === 'terminal-focused';
  const history = receipt.sessionId && plan.history?.sessionId === receipt.sessionId ? plan.history : undefined;
  const terminal = receipt.terminal ?? (focused ? history?.active?.application : undefined);
  const nextStep = pending ? '请核对终端中的实际状态；原请求已保留，避免重复启动。'
    : focused ? '请在原 iCode 会话中读取当前任务上下文。本次仅打开终端，未发送任务。'
      : receipt.executionMode === 'task-file' ? 'iCode 启动后会自动读取任务文件，进度以会话回传为准。'
        : plan.target.taskId ? '进入 iCode 后输入工作指令，当前节点上下文会随首轮输入附带。' : '进入 iCode 后按工作入口读取项目上下文，再开展工作。';
  return <div className="project-work-result">
    <Alert className="project-work-result-status" showIcon type={pending ? 'warning' : 'success'} title={pending ? '启动结果待核对' : focused ? '已打开会话终端' : '已提交启动请求'} />
    <div className="project-work-result-summary">
      <Typography.Text strong>{displayText(plan.title)}</Typography.Text>
      <span className="muted">{plan.projectName} · {plan.location}</span>
      {(history?.title || terminal) && <Descriptions column={1} size="small" items={[
        ...(history?.title ? [{ key: 'session-name', label: '会话', children: history.title }] : []),
        ...(terminal ? [{ key: 'terminal', label: '终端', children: terminal }] : []),
      ]} />}
    </div>
    <p className="project-work-next-step">{nextStep}</p>
    <Collapse className="project-work-details" ghost items={[{ key: 'technical', label: '技术详情', children: <div className="project-work-detail-content">
      <Descriptions column={1} size="small" items={[
        { key: 'request', label: '请求 ID', children: receipt.requestId },
        { key: 'at', label: '记录时间', children: receipt.at },
        { key: 'session', label: '会话 ID', children: receipt.sessionId ?? '等待原生会话记录确认' },
        { key: 'directory', label: '工作目录', children: receipt.directory },
        { key: 'context', label: '上下文文件', children: receipt.contextPath },
        ...(receipt.trace ? [{key:'trace',label:'Trace',children:receipt.trace.diagnostic+' · '+receipt.trace.endpoint}] : []),
      ]} />
      <p className="muted">{displayText(receipt.note)}</p>
      <Typography.Paragraph className="project-work-instruction" copyable={{ text: receipt.instruction, tooltips: ['复制指令', '已复制'] }}>{receipt.instruction}</Typography.Paragraph>
      <Button type="link" onClick={inspect}>查看请求</Button>
    </div> }]} />
    <Space wrap><Button type="primary" aria-label="关闭" onClick={done}>关闭</Button>{pending ? <Button onClick={check}>重新核对请求</Button> : <Button onClick={newWork}>启动新作业</Button>}</Space>
  </div>;
}

export function ProjectWorkLaunch({ target }: { target: ProjectWorkSelection }) {
  const { state, data, role, navigate, showText } = useDemo();
  const taskId = target.taskId ?? target.requirementId;
  const task = taskId ? projectDeliveryTasks(state, target.projectId, role).find(item => item.id === taskId) : undefined;
  const sourceTask = target.projectId === 'teams' ? data.teamsProject.tasks.find(item => item.id === taskId) : undefined;
  const disabledReason = !projectTasksVisibleTo(state, target.projectId, role) ? '当前身份不在该项目任务范围内' : !taskId ? undefined : task ? taskExecutableBy(role, task.assigneeId) ? undefined : task.assigneeId ? `由${task.owner}负责，仅交付人可启动` : '任务尚未分配，请先分配交付人' : sourceTask ? `来源任务由${sourceTask.owner}负责，尚未关联本地交付人` : '此项目中不存在该任务';
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [plan, setPlan] = useState<ProjectWorkPlan>(), [error, setError] = useState('');
  const [action, setAction] = useState<ProjectWorkAction>('new'), [directory, setDirectory] = useState(''), [receipt, setReceipt] = useState<ProjectWorkReceipt>();
  const [reload, setReload] = useState(0), [binding, setBinding] = useState(false);
  const key = JSON.stringify(target);
  useEffect(() => {
    if (!open || disabledReason) return;
    let active = true; setPlan(undefined); setError(''); setReceipt(undefined);
    void getProjectWork(role, JSON.parse(key)).then(value => { if (active) { setPlan(value); setAction(value.defaultAction); setDirectory(value.directory.root ?? ''); } }).catch(cause => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [open, role, key, reload, disabledReason]);
  useEffect(() => { setOpen(false); setReceipt(undefined); setPlan(undefined); }, [key, role, disabledReason]);
  const bind = async () => { setBinding(true); setError(''); try { const value = await bindProjectWork(role, target, directory); setPlan(value); setAction(value.defaultAction); } catch (cause) { setError((cause as Error).message); } finally { setBinding(false); } };
  const chosen = plan?.actions.find(item => item.id === action);
  const pendingPrevious = requestPending(plan?.previous);
  const check = () => { setReceipt(undefined); setReload(value => value + 1); };
  return <><Tooltip title={disabledReason} trigger={['hover', 'focus']}><span className="project-work-entrance" tabIndex={disabledReason ? 0 : undefined} aria-label={disabledReason} title={disabledReason}><Button type="primary" icon={<CodeOutlined />} aria-label="iCode 作业" disabled={!!disabledReason} onClick={() => { setReceipt(undefined); setPlan(undefined); setError(''); if (!disabledReason) setOpen(true); }}>iCode 作业</Button></span></Tooltip>
    <Modal className="project-work-modal" open={open && !disabledReason} centered zIndex={1100} title={receipt ? 'iCode 启动结果' : '启动 iCode'} footer={null} maskClosable={false} closable={!busy && !binding} onCancel={() => setOpen(false)} width={640} destroyOnHidden>
      {error && <Alert type="error" title="工作入口未准备完成" description={displayText(error)} action={<Button onClick={() => setReload(value => value + 1)}>重新读取</Button>} />}
      {!plan && !error && <Spin tip="读取项目目录与 iCode 配置"><div style={{ minHeight: 100 }} /></Spin>}
      {plan && receipt ? <WorkResult plan={plan} receipt={receipt} done={() => setOpen(false)} inspect={() => showText('本次工作入口', JSON.stringify(receipt, null, 2))} check={check} newWork={() => { setReceipt(undefined); setAction('new'); }} /> : plan && <ConfirmWork key={plan.planToken} title={plan.title + ' · ' + plan.location} instance={plan.instance.name} roleLabel={action === 'new' ? plan.instance.agentLabel : plan.history?.configuration?.agentLabel} modelLabel={action === 'new' ? plan.instance.modelLabel : plan.history?.configuration?.modelLabel} disabled={!chosen?.enabled || binding || pendingPrevious} busyChanged={setBusy} saved={setReceipt} startWork={requestId => startProjectWork(role, { requestId, target: plan.target, action, planToken: plan.planToken })}>
        {pendingPrevious && <Alert type="warning" title="上次启动请求待核对" description="请先核对原终端与请求记录，避免重复启动。重新核对只读取已有结果。" action={<Button onClick={check}>重新核对请求</Button>} />}
        <Descriptions size="small" column={1} items={[{ key: 'project', label: '项目', children: plan.projectName }, { key: 'task', label: '当前工作', children: displayRequirementId([plan.target.taskId ?? plan.target.requirementId, plan.location].filter(Boolean).join(' · ')) }, { key: 'dir', label: '使用目录', children: action === 'new' ? plan.directory.root ?? '尚未绑定' : plan.history?.directory }, { key: 'terminal', label: '使用终端', children: action === 'focus' ? plan.history?.active?.application ?? '原会话终端' : plan.instance.terminal?.name ?? '未配置' }, { key: 'context', label: '上下文', children: plan.context.frozen ? '使用已冻结的输入版本' : '尚未冻结，将读取当前准备资料' }]} />
        {!plan.directory.valid && <div className="page-stack"><Alert type="warning" title="需要本机工作目录" description={displayText(plan.directory.diagnostic)} /><Input aria-label="本机工作目录" placeholder="与项目 origin 一致的 Git checkout/worktree 绝对路径" value={directory} disabled={busy || binding} onChange={event => setDirectory(event.target.value)} /><Button loading={binding} disabled={busy || !directory.trim()} onClick={() => void bind()}>核验并绑定目录</Button><p className="muted">只保存当前角色的本机绑定。不会 clone、修改仓库或启动 iCode。</p></div>}
        <Radio.Group aria-label="会话动作" value={action} disabled={busy} onChange={event => setAction(event.target.value)}><Space orientation="vertical">{plan.actions.map(item => <Radio key={item.id} value={item.id} disabled={!item.enabled}>{displayText(item.label)}{!item.enabled && <span className="muted"> · {item.reason && displayText(item.reason)}</span>}</Radio>)}</Space></Radio.Group>
        {plan.history?.diagnostic && <Alert type="warning" title="历史会话未接入此副本" description={displayText(plan.history.diagnostic)} />}
        {action !== 'new' && plan.history && <p className="muted">会话：{plan.history.title}</p>}
        <p className="muted">{action === 'focus' ? '确认后打开原会话终端，请在 iCode 中读取当前任务上下文。' : plan.executionMode === 'task-file' ? '确认后在新终端自动下发任务，执行进度以会话回传为准。' : plan.target.taskId ? '确认后进入可交互的 iCode。提交工作指令时附带当前节点上下文，由你决定后续操作。' : '确认后进入可交互的 iCode；项目上下文入口保留在技术详情中。'}</p>
        <Collapse className="project-work-details" ghost items={[{ key: 'technical', label: '技术详情', children: <><Descriptions size="small" column={1} items={[
          { key: 'source', label: '资料来源', children: displayText(plan.source) },
          { key: 'context', label: '上下文说明', children: displayText(plan.context.summary) },
          { key: 'version', label: '采用版本', children: displayText(plan.context.versions) },
          ...(plan.instance.trace ? [{key:'trace',label:'Trace',children:plan.instance.trace.diagnostic+' · '+plan.instance.trace.endpoint}] : []),
          ...(action !== 'new' && plan.history ? [{ key: 'session', label: '会话 ID', children: plan.history.sessionId }] : []),
          ...(plan.previous ? [{ key: 'previous', label: '上次请求', children: requestTime(plan.previous.at) + ' · ' + (requestPending(plan.previous) ? '结果待核对' : plan.previous.status === 'terminal-focused' ? '已打开终端' : '请求已提交') }] : []),
        ]} />{plan.previous && <><p className="muted">{displayText(plan.previous.note)}</p><Button type="link" onClick={() => showText('上次工作入口', JSON.stringify(plan.previous, null, 2))}>查看上次请求</Button></>}</> }]} />
        <Button type="link" onClick={() => { setOpen(false); navigate('agent'); }}>工具配置与诊断</Button>
      </ConfirmWork>}
    </Modal></>;
}
