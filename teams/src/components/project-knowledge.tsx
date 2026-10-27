import { displayTalentArtifact } from '../talent-artifacts.js';
import { displayText } from '../display-text.js';
import { useEffect, useState } from 'react';
import { Alert, Button, Drawer, Empty, Space, Spin, Tag } from 'antd';
import { getBusinessKnowledge } from '../api.js';
import { useDemo } from '../context.js';
import { FrameworkCard } from '../vendor/teams/components/page-layout.js';
import { talentLink } from './common.js';

type Knowledge = Awaited<ReturnType<typeof getBusinessKnowledge>>;

/** Talent owns current results; the historical Teams knowledge flag is not a result source. */
export function ProjectKnowledge({ projectId, compact = false }: { projectId: string; compact?: boolean }) {
  const { state, role, busy, perform, showText, navigate } = useDemo();
  const [expanded, setExpanded] = useState(false);
  const [result, setResult] = useState<Knowledge | null>(null), [loading, setLoading] = useState(true), [failure, setFailure] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true); setFailure(''); setResult(null);
    getBusinessKnowledge(projectId).then(value => {
      const project = value.projects.find(item => item.id === projectId);
      if (!project) throw new Error('Talent 未返回当前项目的知识状态。');
      const assets = value.assets.filter(asset => asset.sourceProjectId === projectId);
      if (project.status === 'ready' && !assets.length) throw new Error('Talent 项目已标记就绪，但未返回成果，请重新读取。');
      if (live) setResult({ ...value, assets });
    }).catch(error => { if (live) setFailure(error instanceof Error ? error.message : 'Talent 项目知识读取失败'); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [projectId, state.revision, attempt]);
  useEffect(() => { const refresh = () => setAttempt(value => value + 1); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh); }, []);
  const ready = result?.projects.find(project => project.id === projectId)?.status === 'ready';
  const assets = ready ? result?.assets ?? [] : [];
  const enabled = state.workspace.connections.some(connection => connection.id === 'talent' && connection.enabled);
  const hasInputs = projectId === 'carddemo' ? !!state.workspace.project.assets.length : projectId === 'teams' || !!state.workspace.projects?.find(project => project.id === projectId)?.assets?.length;
  const status = loading ? '读取中' : failure ? '读取失败' : ready ? `${assets[0]?.version ?? '项目知识'} 已就绪` : '尚未构建';
  const content = <div className="project-knowledge" data-knowledge-project={projectId}>
      {loading ? <Space><Spin size="small" /><span className="muted">正在读取 Talent 项目知识…</span></Space> : failure ? <Alert showIcon type="error" title="无法读取 Talent 项目知识" description={failure} action={<Button onClick={() => setAttempt(value => value + 1)}>重试</Button>} /> : ready ? <>
        <div className="project-material-list">{assets.map(asset => <div className="project-material" key={asset.id}><div><strong>{displayText(asset.title)}</strong><p>{displayText(asset.summary)}</p><small>{displayText(asset.version ?? '未记录版本')} · Talent 构建</small></div><Button size="small" aria-label={'查看项目知识：' + asset.title} onClick={() => showText(displayText(asset.title), displayTalentArtifact(asset.detail))}>查看</Button></div>)}</div>
        {projectId !== 'carddemo' && <p className="muted">当前成果为已关联资料的来源索引，业务规则仍需抽取与确认。</p>}
      </> : <><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未生成项目知识" /><p className="muted">Talent 尚未为此项目构建成果。{projectId === 'carddemo' ? 'Owner 可基于关联资料发起知识整合。' : 'Owner 可基于关联资料显式构建来源索引。'}</p></>}
      <Space wrap className="card-actions">
        {role === 'owner' && !loading && !failure && <Button data-action="knowledge" type="primary" loading={busy} disabled={ready || !hasInputs || !enabled} onClick={async () => { await perform('knowledge'); setAttempt(value => value + 1); }}>{ready ? '项目知识已整合' : '发起项目知识整合'}</Button>}
        <Button href={talentLink('knowledge', { projectId, role })}>在 Talent 查看成果</Button>
        {!loading && <Button size="small" onClick={() => setAttempt(value => value + 1)}>刷新成果</Button>}
      </Space>
      {!loading && !failure && !ready && !hasInputs && <p className="muted">请先在本项目关联资料。</p>}
      {!enabled && !ready && <p className="muted">等待 Owner 启用 Talent 接入。{role === 'owner' && <Button type="link" size="small" onClick={() => navigate('connections')}>查看企业连接</Button>}</p>}
    </div>;
  const card = <FrameworkCard title="项目知识成果" action={<Tag color={ready && !failure ? 'green' : undefined}>{status}</Tag>}>{content}</FrameworkCard>;
  if (!compact) return card;
  return <div className="overview-knowledge-summary" data-knowledge-summary={projectId}>
    <strong>项目知识</strong><Tag color={ready && !failure ? 'green' : undefined}>{status}</Tag><span className="muted">{failure ? 'Talent 连接或读取失败' : ready ? `${assets.length} 项 Talent 成果` : '按项目读取 Talent 实际状态'}</span><Button size="small" onClick={() => setExpanded(true)}>知识成果</Button>
    {failure && <Button size="small" onClick={() => setAttempt(value => value + 1)}>重试</Button>}
    <Drawer className="project-knowledge-drawer" title="项目知识成果" width={760} open={expanded} onClose={() => setExpanded(false)} destroyOnHidden>{card}</Drawer>
  </div>;
}
