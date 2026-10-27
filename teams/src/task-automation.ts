import { deliveryRequirement, requireDeliveryMember } from './delivery-requirements.js';
import type { TalentTaskSessionReceipt } from './talent-contract.js';
import { requireCurrentTaskMember } from './task-assignment.js';
import type { DemoState, Role } from './domain.js';
import { DomainError } from './domain.js';

export interface TaskScope { projectId: string; taskId: string }
export interface TaskSessionLink extends TaskScope {
  tool: 'icode' | 'opencode'; sessionId: string; nodeId: string; source: 'manual'; at: string;
}
export interface CollectedSession {
  tool: 'icode' | 'opencode'; sessionId: string; nodeIds: string[]; runIds: string[];
  sources: string[]; firstAt: string; lastAt: string;
}
export interface ImportedTaskInputs {
  mode: 'preparation' | 'frozen'; contextId: string | null; requirement: string;
  knowledge: { id: string; title: string; version: string }[];
  knowledgeStatus: string; skills: { id: string; version: string; available: boolean }[];
  references: { id: string; title: string; version: string }[]; materials: { id: string; title: string }[];
  notes: string[];
}
interface AutomaticExecution { id: string; attempts: number; startedAt: string; finishedAt: string | null; error?: string }
export interface KnowledgeImport extends AutomaticExecution { status: 'running' | 'ready' | 'waiting' | 'failed'; inputs?: ImportedTaskInputs }
export interface SessionCollection extends AutomaticExecution { reporting?: { status: 'pending'|'uploading'|'reported'|'failed'; reason: string; receipt?:TalentTaskSessionReceipt }; status: 'queued' | 'running' | 'collected' | 'empty' | 'failed'; sessions: CollectedSession[] }
export interface TaskAutomation extends TaskScope { sessions: TaskSessionLink[]; knowledge?: KnowledgeImport; collection?: SessionCollection }
export const mainTask: TaskScope = { projectId: 'carddemo', taskId: 'DEMO-MKT-001' };
export const sameTask = (a: TaskScope, b: TaskScope) => a.projectId === b.projectId && a.taskId === b.taskId;
export const taskAutomation = (state: DemoState, scope: TaskScope) => state.workspace.taskAutomation?.find(item => sameTask(item, scope));
export function mutableTaskAutomation(state: DemoState, scope: TaskScope) {
  state.workspace.taskAutomation ??= [];
  let record = taskAutomation(state, scope);
  if (!record) { record = { ...scope, sessions: [] }; state.workspace.taskAutomation.push(record); }
  return record;
}
export function requireWritableTask(scope: TaskScope,state?:DemoState) {
  if (!sameTask(scope, mainTask) && !(state&&deliveryRequirement(state,scope.projectId,scope.taskId))) throw new DomainError('所选任务不支持写入自动步骤；导入项目记录保持只读', 403);
}
export function linkTaskSession(state: DemoState, role: Role, input: Record<string, unknown>, at: string) {
  const scope = { projectId: String(input.projectId ?? ''), taskId: String(input.taskId ?? '') }; requireWritableTask(scope,state);
  const live=deliveryRequirement(state,scope.projectId,scope.taskId);
  if(live)requireDeliveryMember(state,live,role);else requireCurrentTaskMember(state);
  if (role !== 'member') throw new DomainError('仅任务成员可以关联工作会话', 403);
  if (live ? !live.preparedAt || ['awaiting-acceptance','accepted'].includes(live.stage) : !state.assigned || !state.context || ['submitted', 'accepted'].includes(state.stage)) throw new DomainError('请在需求上下文冻结后、交付提交前关联开发或验证会话');
  if (!['develop', 'verify'].includes(String(input.nodeId))) throw new DomainError('会话应关联到开发或验证节点');
  if (!['icode', 'opencode'].includes(String(input.tool)) || typeof input.sessionId !== 'string' || !input.sessionId.trim() || input.sessionId.length > 200 || /[\x00-\x1f]/.test(input.sessionId)) throw new DomainError('工具或会话标识无效');
  const record = mutableTaskAutomation(state, scope), sessionId = input.sessionId.trim();
  if (!record.sessions.some(item => item.tool === input.tool && item.sessionId === sessionId && item.nodeId === input.nodeId)) record.sessions.push({ ...scope, tool: input.tool as TaskSessionLink['tool'], sessionId, nodeId: String(input.nodeId), source: 'manual', at });
}
/** Only task-scoped, development/verification associations are eligible; no global/native seed session is inferred. */
export function collectTaskSessions(state: DemoState, scope: TaskScope): CollectedSession[] {
  const entries = new Map<string, CollectedSession>();
  const add = (tool: CollectedSession['tool'], sessionId: string | null, nodeId: string | undefined, at: string, source: string, runId?: string) => {
    if (!sessionId || !nodeId || !['develop', 'verify'].includes(nodeId)) return;
    const key = tool + ':' + sessionId;
    let entry = entries.get(key);
    if (!entry) { entry = { tool, sessionId, nodeIds: [], runIds: [], sources: [], firstAt: at, lastAt: at }; entries.set(key, entry); }
    if (!entry.nodeIds.includes(nodeId)) entry.nodeIds.push(nodeId);
    if (runId && !entry.runIds.includes(runId)) entry.runIds.push(runId);
    if (!entry.sources.includes(source)) entry.sources.push(source);
    if (at < entry.firstAt) entry.firstAt = at; if (at > entry.lastAt) entry.lastAt = at;
  };
  for (const link of taskAutomation(state, scope)?.sessions ?? []) if (sameTask(link, scope)) add(link.tool, link.sessionId, link.nodeId, link.at, '成员关联');
  for (const event of state.workspace.collaboration?.events ?? []) if (event.taskId && sameTask({ projectId: event.projectId, taskId: event.taskId }, scope)) add('icode', event.sessionId, event.nodeId, event.at, 'Teams CLI 回传', event.runId);
  return [...entries.values()].sort((a,b) => a.tool.localeCompare(b.tool) || a.sessionId.localeCompare(b.sessionId));
}
export function queueTaskCollection(state: DemoState, scope = mainTask, at = new Date().toISOString()) {
  const record = mutableTaskAutomation(state, scope);
  if (!record.collection) record.collection = { id: crypto.randomUUID(), attempts: 0, status: 'queued', startedAt: at, finishedAt: null, sessions: [] };
}
export function finishTaskCollection(state: DemoState, scope: TaskScope, sessions: CollectedSession[], at: string) {
  const record = taskAutomation(state, scope)?.collection;
  if ((deliveryRequirement(state,scope.projectId,scope.taskId)?.stage ?? state.stage) !== 'accepted' || !record) throw new DomainError('验收尚未通过或没有归集任务');
  record.sessions = sessions; record.status = sessions.length ? 'collected' : 'empty'; record.finishedAt = at;
  record.reporting = { status: 'pending', reason: sessions.length ? '会话已归集，Talent 上报接口尚未接入；未取得接收回执。' : '尚无关联会话，未发起 Talent 上报。' };
  // Local collection is not an upload receipt; historical reporting fields are left unchanged.
}
export function validateTaskAutomation(state: DemoState) {
  if (!Object.hasOwn(state.workspace, 'taskAutomation')) return;
  const records = state.workspace.taskAutomation;
  if (!Array.isArray(records) || new Set(records.map(record => record.projectId + '/' + record.taskId)).size !== records.length || records.some(record =>
    !record || !(sameTask(record, mainTask)||deliveryRequirement(state,record.projectId,record.taskId)) || !Array.isArray(record.sessions)
    || record.sessions.some(link => !sameTask(link, record) || !['icode','opencode'].includes(link.tool) || !link.sessionId || !['develop','verify'].includes(link.nodeId) || link.source !== 'manual' || typeof link.at !== 'string')
    || record.knowledge && (!record.knowledge.id || !Number.isSafeInteger(record.knowledge.attempts) || !['running','ready','waiting','failed'].includes(record.knowledge.status))
    || record.collection && (!record.collection.id || !Number.isSafeInteger(record.collection.attempts) || !['queued','running','collected','empty','failed'].includes(record.collection.status) || !Array.isArray(record.collection.sessions))
  )) throw new Error('任务自动步骤记录无效；未自动覆盖');
}

/** Node work status is projected from the persisted, task-scoped CLI receipts, independently of acceptance. */
export function taskNodeWorkStatus(state: DemoState, scope: TaskScope, nodeId: string) {
 const latest=(state.workspace.collaboration?.events ?? []).filter(event=>event.projectId===scope.projectId && event.taskId===scope.taskId && event.nodeId===nodeId).sort((a,b)=>b.revision-a.revision)[0];
 return latest ? ({started:'进行中',progress:'进行中',blocked:'阻塞',result:'成果待确认'}[latest.phase]) : null;
}
