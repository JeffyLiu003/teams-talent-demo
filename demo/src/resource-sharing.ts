import type { DemoState } from './domain.js';
import { userSkillExamples } from './project-skill-examples.js';

export const projectSkillIds = ['cobol-legacy-knowledge','arch-impact-analysis','arch-adr-writing','ba-requirement-analysis','ba-acceptance-criteria','dev-backend-service','dev-frontend-ui','dev-code-reviewer','dev-unit-test','qa-integration-test','sec-scan-review','qa-uat-support','ba-requirement-tracing'];
export const availableSkillIds = [...projectSkillIds, ...userSkillExamples.map(skill => skill.id)];
export const shareableResourceIds = [...projectSkillIds, 'code-agent'];
export interface ResourcePublication { id: string; version: string; publishedAt: string | null; scope: 'team'; publisher: 'owner' }
export function resourceVersion(state: DemoState, id: string) {
  return id === 'code-agent' ? state.adoptedAgent : id === 'dev-frontend-ui' ? state.adoptedSkill : '1.0.0';
}
/** Preserve the explicitly saved legacy package shares as individual historical records.
 * This projection never writes old state or grants project-use permissions. */
export function resourcePublications(state: DemoState): ResourcePublication[] {
  const legacy: ResourcePublication[] = state.published ? shareableResourceIds.map(id => ({ id, version: id === 'code-agent' ? 'r1' : '1.0.0', publishedAt: state.audit.find(item => item.action === '发布共享能力包')?.at ?? null, scope: 'team', publisher: 'owner' })) : [];
  const records = new Map(legacy.map(record => [record.id, record]));
  for (const record of state.workspace.resourcePublications ?? []) records.set(record.id, record);
  return [...records.values()];
}
