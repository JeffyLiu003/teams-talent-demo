import { DomainError, type DemoState } from '../src/domain.js';
import type { SourcePluginCatalog } from '../src/source-plugins.js';
import type { TalentProjectContext } from '../src/talent-contract.js';
export const talentActions = ['knowledge', 'candidate', 'evaluate', 'release'] as const;
export type TalentAction = typeof talentActions[number] | 'analysis.run';
export function talentContexts(state: DemoState, catalog: SourcePluginCatalog, teamsName: string): TalentProjectContext[] {
  const generation = state.talentGeneration ?? 'initial';
  return [
    { id: 'carddemo', name: state.workspace.project.name, assets: state.workspace.project.assets, requirementId: 'DEMO-MKT-001', generation },
    { id: 'teams', name: teamsName, generation, assets: catalog.list({ sourceProjectId: 'teams' }).filter(asset => ['repository', 'document'].includes(asset.kind)).map(asset => ({ id: asset.id, title: asset.title, kind: asset.kind, location: asset.references.map(reference => reference.path).join(' · ') || asset.sourceRecordId, sourceAssetId: asset.id })) },
    ...(state.workspace.projects ?? []).map(project => ({ id: project.id, name: project.name, assets: project.assets ?? [], generation })),
  ];
}
export function selectTalentContext(contexts: TalentProjectContext[], id: string) {
  const project = contexts.find(project => project.id === id);
  if (!project) throw new DomainError('项目不存在，无法读取 Talent 上下文', 404);
  return project;
}
export function projectionApplied(state: DemoState, action: TalentAction, payload: Record<string, unknown> = {}) {
  if (action === 'knowledge') return state.knowledge;
  if (action === 'analysis.run') return state.workspace.analysis.status === 'analyzed' && state.workspace.analysis.scope === payload.scope;
  const order = ['none', 'candidate', 'evaluated', 'published', 'adopted'];
  return order.indexOf(state.evolution) >= { candidate: 1, evaluate: 2, release: 3 }[action];
}
