import { createHash, randomUUID } from 'node:crypto';
import inventory from '../fixtures/skill-inventory.json';
import { actionLabels, DomainError } from '../src/domain.js';
import { deliveryRequirement } from '../src/delivery-requirements.js';
import { collectTaskSessions } from '../src/task-automation.js';
import type { TalentIntegrationContext, TalentTaskInputs, TalentTaskInputRegistration, TalentTaskIntake, TalentTaskSession, TalentTaskSessionPayload } from '../src/talent-contract.js';
import type { NativeSkillPackage } from './skill-installation.js';
import { loadSourceSkillPackage } from './skill-packages.js';
import type { TalentStore } from './talent-store.js';
import type { SkillBinding } from '../src/resource-sharing.js';
import { origin as teamsOrigin } from './config.js';

const need: (value: unknown, message: string, status?: number) => asserts value = (value, message, status = 400) => { if (!value) throw new DomainError(message, status); };
const text = (value: unknown, label: string, max = 200) => { need(typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value), label + '无效'); return value; };
const at = (value: unknown, label: string) => { const result = text(value, label, 40); need(/^\d{4}-\d{2}-\d{2}T/.test(result) && Number.isFinite(Date.parse(result)), label + '无效'); return result; };
const digest = (value: unknown, label: string) => { need(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value), label + '无效'); return value; };
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function values(value: unknown, label: string, empty = false) {
  need(Array.isArray(value) && value.length <= 100 && (empty || value.length > 0), label + '无效');
  return [...new Set(value.map(item => text(item, label)))].sort(compare);
}
export function normalizeTaskSessions(value: unknown): TalentTaskSession[] {
  need(Array.isArray(value) && value.length > 0 && value.length <= 200, '会话清单不能为空或超出范围');
  const keys = new Set<string>();
  return value.map((item): TalentTaskSession => {
    need(item && typeof item === 'object', '会话记录无效');
    const raw = item as Record<string, unknown>; need(raw.tool === 'icode' || raw.tool === 'opencode', '会话工具无效');
    const sessionId = text(raw.sessionId, '会话标识'), key = raw.tool + ':' + sessionId; need(!keys.has(key), '会话清单未按工具和标识去重'); keys.add(key);
    const nodeIds = values(raw.nodeIds, '关联节点'); need(nodeIds.every(id => ['develop','verify'].includes(id)), '只接收开发与验证节点会话');
    const firstAt = at(raw.firstAt, '首次关联时间'), lastAt = at(raw.lastAt, '最后关联时间'); need(Date.parse(firstAt) <= Date.parse(lastAt), '会话关联时间顺序无效');
    return { tool: raw.tool, sessionId, nodeIds, runIds: values(raw.runIds, '运行标识', true), sources: values(raw.sources, '关联来源'), firstAt, lastAt };
  }).sort((a,b) => compare(a.tool + ':' + a.sessionId, b.tool + ':' + b.sessionId));
}
function sessionDocuments(value: unknown, sessions: TalentTaskSession[]): NonNullable<TalentTaskSessionPayload['sessionDocuments']> {
  need(Array.isArray(value) && value.length <= sessions.length, '会话文档清单无效'); const ids = new Set<string>();
  return value.map(item => {
    need(item && typeof item === 'object', '会话文档无效'); const sessionId = text(item.sessionId, '文档会话标识');
    need(sessions.some(session => session.sessionId === sessionId) && !ids.has(sessionId), '会话文档标识重复或不属于上报范围'); ids.add(sessionId);
    need(typeof item.content === 'string' && Buffer.byteLength(item.content, 'utf8') > 0 && Buffer.byteLength(item.content, 'utf8') <= 8 * 1024 * 1024, '会话文档为空或超过 8 MiB');
    const sha256 = digest(item.sha256, '会话文档摘要'); need(createHash('sha256').update(item.content, 'utf8').digest('hex') === sha256, '会话文档内容与摘要不一致');
    let document: unknown; try { document = JSON.parse(item.content); } catch { throw new DomainError('会话文档不是合法 JSON', 400); }
    need(document && typeof document === 'object' && !Array.isArray(document), '会话文档必须是 JSON 对象');
    need(sessions.some(session => session.sessionId === sessionId && session.tool === 'icode'), '当前仅接收已核验 iCode 格式的会话文档');
    need((document as { meta?: { session_id?: unknown } }).meta?.session_id === sessionId, '原生会话文档自身标识与上报范围不一致');
    return { sessionId, sha256, content: item.content as string };
  }).sort((a,b) => compare(a.sessionId, b.sessionId));
}
export function taskSessionPayload(value: unknown): TalentTaskSessionPayload {
  need(value && typeof value === 'object' && !Array.isArray(value), '会话上报内容无效'); const input = value as Record<string, unknown>;
  const payload: TalentTaskSessionPayload = { projectId: text(input.projectId, '项目范围'), taskId: text(input.taskId, '任务范围'), deliveryId: text(input.deliveryId, '交付标识'), idempotencyKey: text(input.idempotencyKey, '幂等标识'), acceptedAt: at(input.acceptedAt, '验收时间'), inputDigest: digest(input.inputDigest, '采用依据摘要'), sessions: normalizeTaskSessions(input.sessions) };
  if (Object.hasOwn(input, 'sessionDocuments')) payload.sessionDocuments = sessionDocuments(input.sessionDocuments, payload.sessions);
  return payload;
}
export const taskSessionPayloadDigest = (payload: TalentTaskSessionPayload) => createHash('sha256').update(JSON.stringify(taskSessionPayload(payload))).digest('hex');
export function validateTaskIntakes(value: unknown): asserts value is TalentTaskIntake[] {
  need(Array.isArray(value), 'Talent 会话收件清单损坏'); const keys = new Set<string>(), receiptIds = new Set<string>();
  for (const record of value) {
    need(record && typeof record === 'object', 'Talent 会话收件记录损坏'); const payload = taskSessionPayload(record.payload), receipt = record.receipt;
    text(record.generation, '项目代次'); need(!keys.has(payload.idempotencyKey), 'Talent 会话收件幂等标识重复'); keys.add(payload.idempotencyKey);
    need(receipt && typeof receipt === 'object', 'Talent 收件回执损坏'); text(receipt.id, '回执标识'); at(receipt.receivedAt, '收件时间'); need(!receiptIds.has(receipt.id), 'Talent 收件回执重复'); receiptIds.add(receipt.id);
    need(receipt.projectId === payload.projectId && receipt.taskId === payload.taskId && receipt.payloadSha256 === taskSessionPayloadDigest(payload) && JSON.stringify(receipt.sessionIds) === JSON.stringify([...new Set(payload.sessions.map(item => item.sessionId))]), 'Talent 收件内容与回执不一致');
    need(JSON.stringify(receipt.documentHashes ?? []) === JSON.stringify(payload.sessionDocuments?.map(({ sessionId, sha256 }) => ({ sessionId, sha256 })) ?? []), 'Talent 文档回执与内容不一致');
  }
}
const hashText = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
function registrationSource(ctx: TalentIntegrationContext, taskId: string) {
  const task = deliveryRequirement(ctx.state, ctx.project.id, taskId); need(task, '只有独立交付需求可以登记任务输入', 404);
  const source: TalentTaskInputRegistration['source'] = { kind: 'teams-requirement', projectId: ctx.project.id, taskId, title: task.title, createdAt: task.createdAt, descriptionSha256: hashText(task.description), skillIds: [...task.skillIds] };
  const sourceDigest = hashText(JSON.stringify({ generation: ctx.project.generation, source }));
  return { task, source, sourceDigest };
}
export function validateTaskInputRegistrations(value: unknown): asserts value is TalentTaskInputRegistration[] {
  need(Array.isArray(value), 'Talent 任务输入登记清单损坏'); const scopes = new Set<string>();
  for (const record of value) {
    need(record && typeof record === 'object', 'Talent 任务输入登记损坏'); text(record.projectId, '登记项目'); text(record.taskId, '登记任务'); text(record.generation, '登记代次'); at(record.registeredAt, '登记时间');
    const key = JSON.stringify([record.projectId, record.taskId, record.generation,record.version]); need(!scopes.has(key), 'Talent 任务输入重复登记'); scopes.add(key);
    const source = record.source, asset = record.asset; need(source && source.kind === 'teams-requirement' && source.projectId === record.projectId && source.taskId === record.taskId, 'Talent 登记来源范围无效');
    text(source.title, '来源需求标题'); at(source.createdAt, '来源需求创建时间'); values(source.skillIds, '来源 Skill');
    need(asset && typeof asset.detail === 'string' && asset.origin === 'teams-task' && asset.pluginId === 'business-knowledge' && asset.sourceProjectId === record.projectId && asset.sourceRecordId === record.taskId && asset.references.length === 0, 'Talent 登记知识来源无效');
    need(source.descriptionSha256 === hashText(asset.detail) && record.sourceDigest === hashText(JSON.stringify({ generation: record.generation, source })) && record.version === 'requirement-' + record.sourceDigest.slice(0,12) && asset.version === record.version, 'Talent 登记内容摘要不一致');
  }
}
function taskContext(ctx: TalentIntegrationContext, projectId: string, taskId: string) {
  need(ctx.project.id === projectId, '项目上下文不匹配', 409);
  const task = deliveryRequirement(ctx.state, projectId, taskId);
  if (task) return { title: task.title, description: task.description, skillIds: task.skillIds, skillBindings:task.skillBindings, accepted: task.stage === 'accepted', acceptedAt: task.acceptedAt, inputDigest: task.inputDigest, scoped: true };
  need(projectId === 'carddemo' && taskId === 'DEMO-MKT-001', '任务不存在或不属于所选项目', 404);
  const registered = new Set(inventory.map(item => item.name));
  return { title: '白金卡消费返现需求', description: ctx.state.workspace.project.description, skillIds: ctx.state.workspace.selectedSkills.filter(id => registered.has(id)), accepted: ctx.state.stage === 'accepted', acceptedAt: [...ctx.state.audit].reverse().find(item => item.action === actionLabels.accept)?.at, inputDigest: undefined, scoped: false };
}
export class TalentTaskIntakeService {
  constructor(private store: TalentStore, private context: (projectId: string) => Promise<TalentIntegrationContext>, private origin: string, private loadPackage: (id: string) => Promise<NativeSkillPackage> = loadSourceSkillPackage) {}
  async skill(id:string,binding?:SkillBinding):Promise<TalentTaskInputs['skills'][number]>{
    if(binding?.sha256){
      const response=await fetch(teamsOrigin+'/api/resource-content?'+new URLSearchParams({role:'member',resourceId:id,version:binding.version,sha256:binding.sha256}),{signal:AbortSignal.timeout(5000),redirect:'error'});
      need(response.ok,'固定订阅包读取失败 HTTP '+response.status,502);const data=await response.json();
      need(data.version===binding.version&&data.sha256===binding.sha256&&typeof data.content==='string'&&hashText(data.content)===data.contentSha256&&(!binding.contentSha256||data.contentSha256===binding.contentSha256),'固定订阅正文与采用版本不一致',409);
      return{id,name:id,version:data.version,sha256:data.sha256,contentSha256:data.contentSha256,content:data.content,source:'teams-registered-package'};
    }
    const pkg=await this.loadPackage(id),main=pkg.files.find(file=>file.path==='SKILL.md');need(main,'已登记 Skill 缺少正文',500);need(!binding||pkg.version===binding.version,'已登记 Skill 与所选版本不一致',409);
    return{id:pkg.id,name:pkg.name,version:pkg.version,sha256:pkg.sha256,contentSha256:main.sha256,content:main.bytes.toString('utf8'),source:'teams-registered-package'};
  }
  async register(projectId: string, taskId: string) {
    text(projectId, '项目范围'); text(taskId, '任务范围');
    return this.store.exclusive(async () => {
      const ctx = await this.context(projectId); need(ctx.project.id === projectId, '项目上下文不匹配', 409);
      const { task, source, sourceDigest } = registrationSource(ctx, taskId);
      const registrations=this.store.state.taskInputRegistrations?.filter(record=>record.projectId===projectId&&record.taskId===taskId&&record.generation===ctx.project.generation)??[];
      const prior=registrations.find(record=>record.sourceDigest===sourceDigest);if(prior)return structuredClone(prior);
      // Before adoption a changed Skill selection is another input version, never
      // an overwrite of the requirement facts or a prior registered version.
      for(const record of registrations)need(!task.preparedAt&&record.source.title===source.title&&record.source.createdAt===source.createdAt&&record.source.descriptionSha256===source.descriptionSha256,'任务登记内容已变化，请明确创建新的需求版本，不能覆盖原登记',409);
      // Read and validate the selected registered packages before persisting the task facts.
      await Promise.all(task.skillIds.map(id => this.skill(id,task.skillBindings?.find(binding=>binding.id===id))));
      const version = 'requirement-' + sourceDigest.slice(0,12), registeredAt = new Date().toISOString();
      const record: TalentTaskInputRegistration = { projectId, taskId, generation: ctx.project.generation, version, registeredAt, sourceDigest, source, asset: {
        id: 'business-knowledge:' + projectId + ':task:' + taskId + ':' + sourceDigest.slice(0,12), pluginId: 'business-knowledge', sourceRecordId: taskId, kind: 'knowledge',
        title: '本需求确认内容 · ' + task.title, summary: '来源于 Teams 已确认需求的登记内容。', detail: task.description,
        sourceProjectId: projectId, sourceProjectName: ctx.project.name, origin: 'teams-task', version, updatedAt: registeredAt, references: [], relatedRequirementIds: ['requirements:' + projectId + ':' + taskId],
      } };
      await this.store.saveInputRegistration(record); return structuredClone(record);
    });
  }
  async inputs(projectId: string, taskId: string): Promise<TalentTaskInputs> {
    text(projectId, '项目范围'); text(taskId, '任务范围'); const ctx = await this.context(projectId), task = taskContext(ctx, projectId, taskId), project = this.store.project(ctx.project);
    const ready = project.knowledge.status === 'ready' && !(project.projection.status === 'pending' && project.projection.action === 'knowledge');
    const registrations=this.store.state.taskInputRegistrations?.filter(record=>record.projectId===projectId&&record.taskId===taskId&&record.generation===ctx.project.generation)??[];
    const registration=registrations.length?registrations.find(record=>record.sourceDigest===registrationSource(ctx,taskId).sourceDigest):undefined;
    if(registrations.length)need(registration,'需求已变化，任务登记内容版本不匹配，请重新检查任务输入',409);
    const skills = await Promise.all([...new Set(task.skillIds)].map(id=>this.skill(id,task.skillBindings?.find(binding=>binding.id===id))));
    return { projectId, taskId, generation: ctx.project.generation, origin: this.origin, requirement: { id: taskId, title: task.title, description: task.description }, knowledge: { status: ready || registration ? 'ready' : 'not-built', ...(ready ? { version: project.knowledge.version } : registration ? { version: registration.version } : {}), assets: [...(ready ? structuredClone(project.knowledge.assets) : []), ...(registration ? [structuredClone(registration.asset)] : [])], ...(registration ? { taskRegistration: (({ asset: _, ...metadata }) => metadata)(structuredClone(registration)) } : {}) }, skills };
  }
  async receive(value: unknown) {
    const payload = taskSessionPayload(value), payloadSha256 = taskSessionPayloadDigest(payload);
    return this.store.exclusive(async () => {
      const ctx = await this.context(payload.projectId), task = taskContext(ctx, payload.projectId, payload.taskId);
      need(task.accepted && task.acceptedAt === payload.acceptedAt, '任务尚未验收或验收时间不匹配', 409);
      if (task.scoped) need(task.inputDigest === payload.inputDigest, '采用依据摘要与已验收任务不匹配', 409);
      const sessions = collectTaskSessions(ctx.state, payload);
      need(sessions.length > 0 && JSON.stringify(normalizeTaskSessions(sessions)) === JSON.stringify(payload.sessions), '会话清单与已验收任务的节点关联不一致', 409);
      const previous = this.store.state.taskIntakes?.find(record => record.payload.idempotencyKey === payload.idempotencyKey);
      if (previous) { need(previous.generation === ctx.project.generation && previous.receipt.payloadSha256 === payloadSha256, '幂等标识已用于不同上报内容', 409); return structuredClone(previous.receipt); }
      const record: TalentTaskIntake = { generation: ctx.project.generation, payload, receipt: { id: 'TALENT-INBOX-' + randomUUID(), receivedAt: new Date().toISOString(), projectId: payload.projectId, taskId: payload.taskId, sessionIds: [...new Set(payload.sessions.map(item => item.sessionId))], payloadSha256, ...(payload.sessionDocuments ? { documentHashes: payload.sessionDocuments.map(({ sessionId, sha256 }) => ({ sessionId, sha256 })) } : {}) } };
      await this.store.saveIntake(record); return structuredClone(record.receipt);
    });
  }
}
