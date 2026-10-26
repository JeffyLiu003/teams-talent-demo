import { useEffect, useState } from 'react';
import { Alert, Button, Descriptions, Space, Tag } from 'antd';
import { CheckCircleOutlined, CodeOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useDemo } from '../context.js';
import { getTools, native, type NativeStatus } from '../api.js';
import { FrameworkCard } from '../vendor/teams/components/page-layout.js';
import { Origin, Mono } from '../components/common.js';
import { AgentManagement } from '../components/agent-management.js';

export function NativeControls({ compact = false }: { compact?: boolean }) {
  const { role, run, state, showText } = useDemo();
  const [status, setStatus] = useState<NativeStatus>(), [pending, setPending] = useState(''), [error, setError] = useState(''), [receipt, setReceipt] = useState<any>(null);
  useEffect(() => { let live = true; getTools().then(s => { if (live) setStatus(s); }).catch(e => { if (live) setError(e.message); }); return () => { live = false; }; }, []);
  const verify = async () => {
    setPending('verify'); setError('');
    try { const result = await native(role, 'verify'); setReceipt(result); setStatus(await getTools()); }
    catch (e) { setError((e as Error).message); } finally { setPending(''); }
  };
  const launch = async (restore: boolean) => {
    setPending(restore ? 'restore' : 'start'); setError('');
    try { setReceipt(await native(role, 'launch', { tool: 'icode', restore, requestId: crypto.randomUUID() })); }
    catch (e) { setError((e as Error).message); } finally { setPending(''); }
  };
  const context = async () => { await run(async () => { const value = await native(role, 'context'); showText('iCode 作业上下文 · 已导出文件', value.path + '\n\n建议在 iCode 输入：\n' + value.prompt + '\n\n' + value.content); }); };
  const copyContext = async () => { await run(async () => { const value = await native(role, 'context'); await navigator.clipboard.writeText(value.prompt); }, 'iCode 上下文读取指令已复制'); };
  return <div className="native-controls">
    {!compact && <Descriptions column={1} size="small" items={[{ key: 'version', label: '配套实例', children: status?.icode.version ?? '正在探测…' }, { key: 'directory', label: '项目工作目录', children: <Mono>{status?.icode.workspace ?? '正在读取…'}</Mono> }, { key: 'session', label: '历史会话', children: <span>COBOL 系统迁移 Java 微服务 <Tag>{status?.icode.sessionAvailable ? '已恢复到本机' : '待核验'}</Tag></span> }]} />}
    {status?.icode.active && <Alert type="info" title={'历史会话正在 ' + (status.icode.active.application ?? '另一实例') + ' 中运行'} description={'原生进程 ' + status.icode.active.pid + ' 持有会话，请在原窗口继续；未启动重复实例。'} action={status.icode.active.application ? <Button onClick={() => void run(async () => { setReceipt(await native(role, 'focus')); })}>打开已运行会话</Button> : undefined} />}
    <Space wrap><Button type="primary" icon={<PlayCircleOutlined />} loading={pending === 'restore'} disabled={!status?.icode.installed || !status?.icode.sessionAvailable || !!status?.icode.active || !!pending && pending !== 'restore'} onClick={() => void launch(true)}>恢复 iCode 历史会话</Button><Button icon={<CodeOutlined />} loading={pending === 'start'} disabled={!status?.icode.installed || !!pending && pending !== 'start'} onClick={() => void launch(false)}>启动 iCode</Button><Button icon={<CheckCircleOutlined />} loading={pending === 'verify'} disabled={!status?.icode.installed || !!pending && pending !== 'verify'} onClick={() => void verify()}>核验原生会话</Button>{state.context && <><Button onClick={() => void context()}>导出作业上下文</Button><Button onClick={() => void copyContext()}>复制上下文指令</Button></>}</Space>
    {error && <Alert type="error" title="本机操作未完成" description={error} showIcon />}
    {receipt && <Alert type={receipt.status === 'history-readable-active' ? 'info' : 'success'} showIcon title={receipt.status === 'verified' ? '原生历史会话核验通过' : receipt.status === 'history-readable-active' ? '历史可读取，原会话正在运行' : receipt.status === 'application-focused' ? '已打开 ' + receipt.application : '已请求 ' + (receipt.terminal ?? '本机终端') + ' 打开工具'} description={receipt.status === 'verified' ? 'ACP 列表、历史与加载均成功，共读取 ' + receipt.messageCount + ' 条消息。没有向模型发送指令。' : receipt.status === 'history-readable-active' ? 'ACP 已读取 ' + receipt.messageCount + ' 条历史消息；加载被原生会话锁拒绝，请直接打开已有实例。' : receipt.note} />}
    <p className="muted native-note">真实调用本机 iCode 0.31.0。上下文导出为文件，需在 iCode 中显式读取；历史回放不会重新执行模型。</p>
  </div>;
}

export function Tools() {
  return <AgentManagement nativeControls={<NativeControls />} />;
}

export function SessionReporting(){
  const {state,role,update,busy}=useDemo(),w=state.workspace;
  return <div className="page-stack"><FrameworkCard title="交付会话与上报" action={<Origin kind="simulated"/>}><Descriptions column={1} items={[
    {key:'title',label:'历史会话',children:'COBOL 系统迁移 Java 微服务'},
    {key:'requirement',label:'本次关联',children:'MKT-001 / 信用卡消费返现'},
    {key:'status',label:'上报状态',children:<Tag color={w.sessionReported?'green':'gold'}>{w.sessionReported?'已关联':'待提交后上报'}</Tag>},
    {key:'at',label:'上报时间',children:w.reportAt?new Date(w.reportAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}):'—'},
  ]}/><Space wrap><Button data-workspace="session.report" type="primary" loading={busy} disabled={role!=='member'||!['submitted','accepted'].includes(state.stage)||w.sessionReported||!w.foundation.uploadEnabled} onClick={()=>void update('session.report',{})}>上报并关联会话</Button><Button href="#/trace">查看会话与基础分析</Button></Space><p className="muted">此操作登记工作区内的需求与会话关系。原始会话不被改写，也不向远端上传。</p></FrameworkCard><FrameworkCard title="原生会话入口" action={<Origin kind="native"/>}><NativeControls compact/></FrameworkCard></div>;
}
