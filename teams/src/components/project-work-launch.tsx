import { displayText, displayRequirementId } from '../display-text.js';
import { useEffect, useState } from 'react';
import { Alert, Button, Descriptions, Input, Modal, Radio, Space, Spin, Typography } from 'antd';
import { CodeOutlined } from '@ant-design/icons';
import { useDemo } from '../context.js';
import { bindProjectWork, getProjectWork, startProjectWork } from '../api.js';
import type { ProjectWorkAction, ProjectWorkPlan, ProjectWorkReceipt, ProjectWorkSelection } from '../project-work.js';
import { ConfirmWork } from '../vendor/teams/work/confirm-work.js';

export function ProjectWorkLaunch({ target }: { target: ProjectWorkSelection }) {
  const { role, navigate, showText } = useDemo();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [plan, setPlan] = useState<ProjectWorkPlan>(), [error, setError] = useState('');
  const [action, setAction] = useState<ProjectWorkAction>('new'), [directory, setDirectory] = useState(''), [receipt, setReceipt] = useState<ProjectWorkReceipt>();
  const [reload, setReload] = useState(0), [binding, setBinding] = useState(false);
  const key = JSON.stringify(target);
  useEffect(() => {
    if (!open) return;
    let active = true; setPlan(undefined); setError(''); setReceipt(undefined);
    void getProjectWork(role, JSON.parse(key)).then(value => { if (active) { setPlan(value); setAction(value.defaultAction); setDirectory(value.directory.root ?? ''); if (value.previous) setReceipt(value.previous); } }).catch(cause => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [open, role, key, reload]);
  const bind = async () => { setBinding(true); setError(''); try { const value = await bindProjectWork(role, target, directory); setPlan(value); setAction(value.defaultAction); } catch (cause) { setError((cause as Error).message); } finally { setBinding(false); } };
  const chosen = plan?.actions.find(item => item.id === action);
  return <><Button type="primary" icon={<CodeOutlined />} aria-label="iCode 作业" onClick={() => setOpen(true)}>iCode 作业</Button>
    <Modal open={open} centered zIndex={1100} title="开始 iCode 工作" footer={null} maskClosable={false} closable={!busy && !binding} onCancel={() => setOpen(false)} width={640} destroyOnHidden>
      {error && <Alert type="error" title="工作入口未准备完成" description={displayText(error)} action={<Button onClick={() => setReload(value => value + 1)}>重新读取</Button>} />}
      {!plan && !error && <Spin tip="读取项目目录与 iCode 配置"><div style={{ minHeight: 100 }} /></Spin>}
      {plan && receipt ? <div className="page-stack"><Alert type={receipt.status === 'uncertain' || receipt.status === 'prepared' ? 'warning' : 'success'} title={receipt.status === 'terminal-focused' ? '已进入历史会话终端' : receipt.status === 'terminal-requested' ? '已请求进入 iCode 会话' : '原作业请求待核对'} description={displayText(receipt.note)} /><Descriptions column={1} size="small" items={[{ key: 'request', label: '请求', children: receipt.requestId }, { key: 'directory', label: '工作目录', children: receipt.directory }, { key: 'session', label: '会话', children: receipt.sessionId ?? '新会话身份待原生运行记录确认' }]} /><Typography.Paragraph copyable={{ text: receipt.instruction }}>{receipt.instruction}</Typography.Paragraph><p className="muted">{receipt.executionMode === 'task-file' ? '已将本次任务文件交给 iCode run。无需复制提示；上下文读取、进度与结果以实际会话回传为准。' : '交互终端会显示上述指引，需在会话中显式读取。进入已有终端不会发送输入，也不会更改任务状态。'}</p><Space wrap><Button type="primary" aria-label="完成" onClick={() => setOpen(false)}>完成</Button><Button onClick={() => showText('本次工作入口', JSON.stringify(receipt, null, 2))}>查看请求</Button><Button onClick={() => { setReceipt(undefined); setAction('new'); }}>新建另一个作业</Button></Space></div> : plan && <ConfirmWork key={plan.planToken} title={plan.title + ' · ' + plan.location} instance={plan.instance.name} roleLabel={action === 'new' ? plan.instance.agentLabel : plan.history?.configuration?.agentLabel} modelLabel={action === 'new' ? plan.instance.modelLabel : plan.history?.configuration?.modelLabel} disabled={!chosen?.enabled || binding} busyChanged={setBusy} saved={setReceipt} startWork={requestId => startProjectWork(role, { requestId, target: plan.target, action, planToken: plan.planToken })}>
        <Descriptions size="small" column={1} items={[{ key: 'project', label: '项目', children: plan.projectName }, { key: 'task', label: '当前工作', children: displayRequirementId([plan.target.taskId ?? plan.target.requirementId, plan.location].filter(Boolean).join(' · ')) }, { key: 'dir', label: '使用目录', children: action === 'new' ? plan.directory.root ?? '尚未绑定' : plan.history?.directory }, { key: 'terminal', label: '使用终端', children: action === 'focus' ? plan.history?.active?.application ?? '原会话终端' : plan.instance.terminal?.name ?? '未配置' }, { key: 'source', label: '资料来源', children: displayText(plan.source) }, { key: 'context', label: '上下文', children: displayText(plan.context.summary) }, { key: 'version', label: '采用版本', children: displayText(plan.context.versions) }]} />
        {!plan.directory.valid && <div className="page-stack"><Alert type="warning" title="需要本机工作目录" description={displayText(plan.directory.diagnostic)} /><Input aria-label="本机工作目录" placeholder="与项目 origin 一致的 Git checkout/worktree 绝对路径" value={directory} disabled={busy || binding} onChange={event => setDirectory(event.target.value)} /><Button loading={binding} disabled={busy || !directory.trim()} onClick={() => void bind()}>核验并绑定目录</Button><p className="muted">只保存当前角色的本机绑定。不会 clone、修改仓库或启动 iCode。</p></div>}
        <Radio.Group aria-label="会话动作" value={action} disabled={busy} onChange={event => setAction(event.target.value)}><Space orientation="vertical">{plan.actions.map(item => <Radio key={item.id} value={item.id} disabled={!item.enabled}>{displayText(item.label)}{!item.enabled && <span className="muted"> · {item.reason && displayText(item.reason)}</span>}</Radio>)}</Space></Radio.Group>
        {plan.history?.diagnostic && <Alert type="warning" title="历史会话未接入此副本" description={displayText(plan.history.diagnostic)} />}
        {action !== 'new' && plan.history && <Alert type="info" title={'历史会话：' + plan.history.title} description={`该会话来自当前项目的历史材料，不代表已采用当前需求或节点。${plan.history.active?.terminal ? '已定位唯一同标题 Ghostty 终端：' + plan.history.active.terminal.directory : '恢复时保持历史工作目录。'}`} />}
        <p className="muted">{plan.executionMode === 'task-file' ? '确认后在新终端调用 iCode 执行本次任务文件，由会话先读取 Teams Skill 与当前节点上下文，再采用依据并回传实际进展。执行结束停留在待 Owner 验收。' : '确认后直接进入本机终端中的 iCode。先通过 Teams Skill/CLI 获取最新上下文，再明确采用输入与同步实际进展；提供入口不代表已经读取。'}</p>
        <Button type="link" onClick={() => { setOpen(false); navigate('agent'); }}>工具配置与诊断</Button>
      </ConfirmWork>}
    </Modal></>;
}
