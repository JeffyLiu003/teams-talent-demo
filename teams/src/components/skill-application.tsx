import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Descriptions, Modal, Select, Space, Spin } from 'antd';
import { applySkillApplication, getSkillApplication } from '../api.js';
import { useDemo } from '../context.js';
import { currentSystemContext } from '../system-links.js';

type Plan = Awaited<ReturnType<typeof getSkillApplication>>;
type Receipt = Awaited<ReturnType<typeof applySkillApplication>>;

/** Subscription installation is separate from the task's selected and frozen inputs. */
export function SkillApplication({ resourceId, version, sha256, projectId: initialProject }: { resourceId: string; version: string; sha256: string; projectId?: string }) {
  const { state, data, role } = useDemo();
  const [open, setOpen] = useState(false), [projectId, setProjectId] = useState(initialProject ?? currentSystemContext().projectId);
  const [plan, setPlan] = useState<Plan>(), [receipt, setReceipt] = useState<Receipt>();
  const [receiptDetails, setReceiptDetails] = useState(false);
  const [loading, setLoading] = useState(false), [applying, setApplying] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const requestId = useRef('');
  const scopeKey = `${role}:${projectId}:${resourceId}:${version}:${sha256}`;
  const activeScope = useRef(scopeKey); activeScope.current = scopeKey;
  const projects = [{ value: 'carddemo', label: state.workspace.project.name }, { value: 'teams', label: data.teamsProject.project.name }, ...(state.workspace.projects ?? []).map(project => ({ value: project.id, label: project.name }))];
  useEffect(() => { setOpen(false); setReceipt(undefined); }, [role, resourceId, version, sha256]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setPlan(undefined); setReceipt(undefined); setReceiptDetails(false); setError(''); setLoading(true); setApplying(false); requestId.current = crypto.randomUUID();
    void getSkillApplication(role, { projectId, resourceId, version, sha256 }).then(value => { if (active) setPlan(value); }, cause => { if (active) setError((cause as Error).message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, scopeKey, retry]);
  const apply = async () => {
    if (!plan?.canApply || applying) return;
    const key = scopeKey;
    setApplying(true); setError('');
    try {
      const result = await applySkillApplication(role, { projectId, resourceId, version, sha256, planToken: plan.planToken, requestId: requestId.current });
      if (activeScope.current === key) setReceipt(result);
    } catch (cause) { if (activeScope.current === key) setError((cause as Error).message); }
    finally { if (activeScope.current === key) setApplying(false); }
  };
  return <>
    <Button size="small" data-skill-apply={resourceId} aria-label={'应用到 iCode：' + resourceId} onClick={() => setOpen(true)}>应用到 iCode</Button>
    <Modal title={resourceId + ' · 应用到本机用户 iCode'} open={open} width={680} closable={!applying} maskClosable={!applying} onCancel={() => setOpen(false)} footer={receipt ? <Button type="primary" aria-label="完成" onClick={() => setOpen(false)}>完成</Button> : <Space><Button aria-label="取消" disabled={applying} onClick={() => setOpen(false)}>取消</Button><Button type="primary" data-skill-apply-confirm loading={applying} disabled={loading || !plan?.canApply} onClick={() => void apply()}>{error && plan ? '重试同一应用请求' : '应用到本机用户 iCode'}</Button></Space>}>
      <div className="page-stack">
        <p>将当前用户订阅的固定版本写入本机用户 iCode Skill 目录，供不同项目使用，并核验发现与读取情况。此操作不更改已冻结的任务上下文，也不会启动模型。</p>
        <p className="muted">角色切换不会切换操作系统用户。本机用户安装目录共享，但不会自动替其他角色订阅；来源项目仅用于记录本次应用上下文。</p>
        <Select aria-label="Skill 应用来源项目" value={projectId} options={projects} disabled={applying || !!receipt} onChange={setProjectId} />
        {loading && <Spin tip="核验订阅版本与目标目录"><div style={{ minHeight: 48 }} /></Spin>}
        {error && <Alert type="error" showIcon title="Skill 应用未完成" description={error} action={!plan && <Button onClick={() => setRetry(value => value + 1)}>重新核验</Button>} />}
        {plan && !receipt && <><Descriptions column={1} size="small" items={[{ key: 'user', label: '订阅用户', children: role === 'owner' ? '林悦' : '陈晨' }, { key: 'version', label: '订阅版本', children: version }, { key: 'project', label: '来源项目', children: plan.projectName }, { key: 'directory', label: '本机用户 Skill 目录', children: <code style={{ overflowWrap: 'anywhere' }}>{plan.targetDirectory || '尚未确认'}</code> }, { key: 'skill', label: '应用路径', children: <code style={{ overflowWrap: 'anywhere' }}>{plan.skillDirectory || '待目录核验'}</code> }, { key: 'sha', label: 'Skill 包 SHA-256', children: <code style={{ overflowWrap: 'anywhere' }}>{sha256}</code> }]} />{!plan.canApply && <Alert type="warning" title="当前不能应用" description={plan.reason} />}</>}
        {receipt && <><Alert type={receipt.discovery.status === 'discovered-and-read' ? 'success' : 'warning'} showIcon title={receipt.status === 'already-applied' ? '此版本已应用' : 'Skill 文件已应用'} description={receipt.note} /><Descriptions column={1} size="small" items={[{ key: 'version', label: '应用版本', children: receipt.version }, { key: 'directory', label: '本机用户 Skill 目录', children: <code style={{ overflowWrap: 'anywhere' }}>{receipt.targetDirectory}</code> }, { key: 'path', label: 'Skill 路径', children: <code style={{ overflowWrap: 'anywhere' }}>{receipt.skillDirectory}</code> }, { key: 'discovery', label: 'iCode 发现核验', children: receipt.discovery.status === 'discovered-and-read' ? '已发现并读取' : receipt.discovery.status === 'failed' ? '核验失败' : '未核验' }, { key: 'hash', label: 'Skill 包 SHA-256', children: <code style={{ overflowWrap: 'anywhere' }}>{receipt.sha256}</code> }]} /><Button aria-expanded={receiptDetails} onClick={() => setReceiptDetails(value => !value)}>查看完整应用回执</Button>{receiptDetails && <pre className="evidence-console" data-skill-application-receipt style={{ maxHeight: 280, overflow: 'auto' }}>{JSON.stringify(receipt, null, 2)}</pre>}<p>{receipt.discovery.note}</p><p className="muted">文件应用与工具发现不代表当前运行中的会话已重新加载，也不代表模型已执行该 Skill。</p></>}
      </div>
    </Modal>
  </>;
}
