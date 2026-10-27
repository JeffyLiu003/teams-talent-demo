import { Tag } from 'antd';
import type { CollaborationEvent } from '../collaboration.js';
import type { OverviewFilter, OverviewRequirement } from '../project-overview.js';

export const metricGroups: { tab: 'requirements' | 'issues'; title: string; note: string; metrics: { key: OverviewFilter; label: string }[] }[] = [
  { tab: 'requirements', title: '需求概览', note: '总数由四个互斥阶段组成；进行中包含准备、开发与验证。', metrics: [
    { key: 'all', label: '需求总数' }, { key: 'pending', label: '待开展' }, { key: 'active', label: '进行中' },
    { key: 'acceptance', label: '待验收' }, { key: 'delivered', label: '已交付' },
  ] },
  { tab: 'issues', title: '问题概览', note: '总数＝未关闭＋已关闭＋待确认；阻塞交付是未关闭问题的子集。', metrics: [
    { key: 'issues', label: '问题总数' }, { key: 'open', label: '未关闭' }, { key: 'closed', label: '已关闭' },
    { key: 'unconfirmed', label: '待确认' }, { key: 'blocking', label: '阻塞交付' },
  ] },
];
const reportLabels = { started: '已开始', progress: '进度回传', blocked: '报告阻塞', result: '结果待确认' };
export function Report({ event }: { event: CollaborationEvent }) { return <div className="overview-report"><Tag color={event.phase === 'blocked' ? 'gold' : undefined}>{reportLabels[event.phase]}</Tag><span>{event.summary}</span>{event.nodeId && <small>节点 {event.nodeId}</small>}</div>; }
export function Quality({ item }: { item: OverviewRequirement }) { return <div className="overview-quality">{item.quality.map(result => <span key={result.label}><span className="muted">{result.label}</span><Tag color={result.passed ? 'green' : undefined}>{result.result}</Tag></span>)}</div>; }


export type TaskCategory = 'requirements' | 'issues' | 'general';
export function taskManagementRoute(projectId: string, category: TaskCategory = 'requirements', extra: Record<string, string> = {}) {
  return 'projects?' + new URLSearchParams({ project: projectId, tab: 'management', category, ...extra });
}
