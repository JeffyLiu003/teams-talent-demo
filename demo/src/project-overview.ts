import type { Presentation } from './api.js';
import type { DemoState } from './domain.js';
import type { CollaborationEvent } from './collaboration.js';
import { createSourcePluginCatalog, type SourcePluginAsset } from './source-plugins.js';

export type DeliveryPhase = '待开展' | '准备' | '开发' | '验证' | '待验收' | '已交付';
export type OverviewFilter = 'all' | 'active' | 'acceptance' | 'delivered' | 'open' | 'blocking';
export interface QualityConclusion { label: string; result: string; passed: boolean }
export interface OverviewRequirement {
  id: string; source: SourcePluginAsset; owner: string; phase: DeliveryPhase; due?: string; overdue: boolean;
  taskId?: string; route?: string; scope: string; pendingConfirmation: boolean; issues: OverviewIssue[]; quality: QualityConclusion[]; activity?: CollaborationEvent;
}
export interface OverviewIssue {
  id: string; source: SourcePluginAsset; owner: string; severity: string; status: string; progress: string;
  closed: boolean | null; confirmed: boolean; blocksDelivery: boolean; relatedIds: string[];
}
export interface ProjectOverview { requirements: OverviewRequirement[]; research: OverviewRequirement[]; issues: OverviewIssue[]; counts: Record<OverviewFilter, number>; scope: string; asOf: string; projectActivity?: CollaborationEvent }
const route = (project: string, tab: string, extra: Record<string, string> = {}) => 'projects?' + new URLSearchParams({ project, tab, ...extra });
const unknownQuality = (): QualityConclusion[] => [
  { label: '功能', result: '未验收', passed: false }, { label: 'Review', result: '未提供报告', passed: false },
  { label: '测试', result: '未检查', passed: false }, { label: '安全', result: '待验证', passed: false },
];
const phases: Record<DemoState['stage'], DeliveryPhase> = { draft: '待开展', assigned: '准备', developing: '开发', failed: '验证', fixed: '验证', submitted: '待验收', returned: '开发', accepted: '已交付' };

/** Source identity defines one row; adopted Teams tasks contribute delivery facts to that row. */
export function projectOverview(state: DemoState, data: Presentation, projectId: string, asOf = new Date().toISOString().slice(0, 10)): ProjectOverview {
  const catalog = createSourcePluginCatalog(data);
  const associated = projectId === 'carddemo' ? state.workspace.project.assets : state.workspace.projects?.find(project => project.id === projectId)?.assets ?? [];
  // These are explicit demo project links, separate from provider availability.
  const included = new Set(associated.flatMap(asset => asset.sourceAssetId ? [asset.sourceAssetId] : []));
  if (projectId === 'carddemo') ['requirements:carddemo:DEMO-MKT-001', 'defects:carddemo:CARD-BUG-001', 'defects:carddemo:CARD-BUG-002'].forEach(id => included.add(id));
  if (projectId === 'teams') [...data.teamsProject.tasks.map(task => `requirements:teams:REQ-${task.id}`), 'requirements:teams:REQ-WINDOWS-RECONNECT', 'defects:teams:TEAMS-BUG-001'].forEach(id => included.add(id));
  const sources = [...included].map(id => catalog.get(id)).filter((asset): asset is SourcePluginAsset => !!asset);
  const allWork: OverviewRequirement[] = sources.filter(source => source.kind === 'requirement').map(source => {
    const item: OverviewRequirement = { id: source.id, source, owner: '未分配', phase: '待开展', due: undefined, overdue: false, scope: '已关联来源 · 未纳入 Teams 交付', pendingConfirmation: true, issues: [], quality: unknownQuality() };
    if (projectId === 'carddemo' && source.id === 'requirements:carddemo:DEMO-MKT-001') {
      item.taskId = 'DEMO-MKT-001'; item.owner = state.assigned ? '陈晨' : '待分配'; item.phase = phases[state.stage]; item.pendingConfirmation = !state.assigned;
      item.scope = 'Teams 演示交付'; item.route = route(projectId, state.assigned ? 'delivery' : 'management', state.assigned ? { node: state.stage === 'submitted' || state.stage === 'accepted' ? 'accept' : state.stage === 'failed' || state.stage === 'fixed' ? 'verify' : state.stage === 'developing' || state.stage === 'returned' ? 'develop' : 'prepare' } : {});
      item.quality = [
        { label: '功能', result: state.stage === 'accepted' ? '验收通过' : state.uat ? '边界验收通过（模拟）' : '待验收', passed: state.stage === 'accepted' },
        { label: 'Review', result: '1 项待核验', passed: false },
        { label: '测试', result: state.checks === 'passed' ? state.stage === 'returned' ? '历史 9/9 · 待复验' : '历史复测 9/9' : state.checks === 'failed' ? '历史检查 7/8 · 失败' : '未检查', passed: state.checks === 'passed' && state.stage !== 'returned' },
        { label: '安全', result: '待验证', passed: false },
      ];
    } else if (projectId === 'teams') {
      const task = data.teamsProject.tasks.find(task => source.id === `requirements:teams:REQ-${task.id}`);
      if (task) {
        item.taskId = task.id; item.owner = '成员 ' + task.owner; item.due = task.due; item.pendingConfirmation = false; item.scope = 'Teams 交付快照';
        const accept = task.nodes.find(node => node.id === 'accept'), build = task.nodes.find(node => node.id === 'build'), test = task.nodes.find(node => node.id === 'test');
        item.phase = task.status === '已验收' ? '已交付' : task.status === '待验收' ? '待验收' : task.status === '待开始' ? '待开展' : test && !['未执行', '未开始'].includes(test.status) ? '验证' : build && !['未开始', '未提交'].includes(build.status) ? '开发' : '准备';
        const node = item.phase === '已交付' || item.phase === '待验收' ? 'accept' : item.phase === '验证' ? 'test' : item.phase === '开发' ? 'build' : task.id === 'T104' ? 'review' : task.nodes[0].id;
        item.route = route(projectId, 'delivery', { task: task.id, node });
        item.quality = [{ label: '功能', result: accept?.status === '已完成' ? '已验收（快照）' : '待验收', passed: accept?.status === '已完成' }, { label: 'Review', result: '未提供代码报告', passed: false }, { label: '测试', result: test?.status === '已完成' ? '完成记录（快照）' : task.type === '调研' && !test ? '不适用（调研）' : '未检查', passed: false }, { label: '安全', result: '待验证', passed: false }];
      }
    }
    item.overdue = !!item.due && /^\d{4}-\d{2}-\d{2}$/.test(item.due) && item.due < asOf && item.phase !== '已交付';
    return item;
  });
  const requirements = allWork.filter(item => !item.source.requirement || item.source.requirement.category === 'requirement');
  const research = allWork.filter(item => item.source.requirement?.category === 'research');
  const latestReport = (taskId?: string) => (state.workspace.collaboration?.events ?? []).filter(event => event.projectId === projectId && event.taskId === taskId).reduce<CollaborationEvent | undefined>((latest, event) => !latest || event.revision > latest.revision ? event : latest, undefined);
  for (const item of allWork) if (item.taskId) item.activity = latestReport(item.taskId);
  const issues: OverviewIssue[] = sources.filter(source => source.kind === 'defect').map(source => {
    const issue = source.issue;
    const item: OverviewIssue = { id: source.id, source, owner: issue?.owner ?? '未分配', severity: issue?.severity ?? '未标注', status: issue?.status ?? '待确认', progress: issue?.progress ?? '暂无处理记录', closed: issue?.closed ?? null, confirmed: issue?.confirmed ?? false, blocksDelivery: false, relatedIds: [...source.relatedRequirementIds] };
    let blocking = issue?.blocksDelivery ?? false;
    if (projectId === 'carddemo' && source.id === 'defects:carddemo:CARD-BUG-001' && state.checks !== 'none') {
      item.closed = state.checks === 'passed'; item.status = item.closed ? '已修复关闭' : '待修复'; blocking = !item.closed;
      item.progress = item.closed ? '历史修复 E4 与复测 E5 已采用' : '历史检查 E3：7/8，等待修复与复测';
    }
    item.blocksDelivery = item.closed === false && blocking && requirements.some(requirement => item.relatedIds.includes(requirement.id) && requirement.taskId && requirement.phase !== '已交付');
    return item;
  });
  for (const requirement of requirements) requirement.issues = issues.filter(issue => issue.closed !== true && issue.confirmed && issue.relatedIds.includes(requirement.id));
  const result: ProjectOverview = { requirements, research, issues, counts: { all: requirements.length, active: 0, acceptance: 0, delivered: 0, open: 0, blocking: 0 }, scope: projectId === 'teams' ? `已纳入交付的 ${requirements.length} 项需求与 ${research.length} 项调研分别统计；待确认讨论尚未转成任务。进度与计划来自演示快照。` : projectId === 'carddemo' ? '本项目主需求及已关联来源；交付阶段随 Teams 演示状态更新。' : '仅统计本项目已关联的需求与问题；来源关联不代表已进入交付。', asOf };
  for (const filter of ['active', 'acceptance', 'delivered'] as const) result.counts[filter] = filterRequirements(result, filter).length;
  for (const filter of ['open', 'blocking'] as const) result.counts[filter] = filterIssues(result, filter).length;
  result.projectActivity = latestReport();
  return result;
}
export function filterRequirements(data: ProjectOverview, filter: OverviewFilter) { return data.requirements.filter(item => filter === 'active' ? ['准备', '开发', '验证'].includes(item.phase) : filter === 'acceptance' ? item.phase === '待验收' : filter === 'delivered' ? item.phase === '已交付' : true); }
export function filterIssues(data: ProjectOverview, filter: OverviewFilter) { return data.issues.filter(item => filter === 'blocking' ? item.blocksDelivery : filter === 'open' ? item.closed === false : true); }
