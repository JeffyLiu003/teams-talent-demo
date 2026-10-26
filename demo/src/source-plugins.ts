import type { Presentation } from './api.js';
import { externalPlatforms } from './external-platforms.js';

export type SourcePluginId = typeof externalPlatforms[number]['id'];
export type SourceProjectId = string;
export type SourceAssetKind = 'repository' | 'code' | 'requirement' | 'defect' | 'document' | 'test-case' | 'knowledge';

export interface SourceAssetReference {
  readonly collection: 'sources' | 'teams-documents' | 'graph';
  readonly path: string;
  readonly label: string;
  readonly extent: 'full-file' | 'excerpt';
  readonly origin: 'existing-local-file';
}

/** A source record is available for selection; it is never a project association. */
export interface SourcePluginAsset {
  readonly id: string;
  readonly pluginId: SourcePluginId;
  readonly sourceRecordId: string;
  readonly kind: SourceAssetKind;
  readonly title: string;
  readonly summary: string;
  readonly detail: string;
  readonly sourceProjectId: SourceProjectId;
  readonly sourceProjectName: string;
  readonly origin: 'plugin-mock';
  readonly version?: string;
  readonly updatedAt?: string;
  readonly references: readonly SourceAssetReference[];
  /** Stable asset IDs in the requirements plugin, within the same source project. */
  readonly relatedRequirementIds: readonly string[];
  readonly requirement?: { category: 'requirement' | 'research' | 'issue-input'; owner: string; plannedEnd?: string; taskId?: string };
  readonly issue?: { owner: string; severity: string; status: string; closed: boolean | null; confirmed: boolean; blocksDelivery: boolean; progress: string };
}

export type SourcePluginData = Pick<Presentation, 'blueprint' | 'teamsProject' | 'sources'> & Partial<Pick<Presentation, 'graph'>> & { talentKnowledgeAssets?: readonly SourcePluginAsset[] };
export interface SourceAssetFilter { pluginId?: SourcePluginId; sourceProjectId?: SourceProjectId }
export interface SourcePluginProvider {
  readonly id: SourcePluginId;
  readonly name: string;
  readonly kinds: readonly SourceAssetKind[];
  provide(data: SourcePluginData): readonly SourcePluginAsset[];
}
export interface SourcePluginCatalog {
  readonly plugins: readonly SourcePluginProvider[];
  list(filter?: SourceAssetFilter): readonly SourcePluginAsset[];
  get(assetId: string): SourcePluginAsset | undefined;
  readReference(reference: SourceAssetReference): string | undefined;
}

export const sourceAssetKindLabels: Record<SourceAssetKind, string> = {
  repository: '代码仓', code: '代码资产', requirement: '需求', defect: '问题单 / 缺陷', document: '设计与业务资料', 'test-case': '测试用例', knowledge: '业务知识',
};
export const sourceAssetId = (pluginId: SourcePluginId, projectId: SourceProjectId, sourceRecordId: string) => `${pluginId}:${projectId}:${sourceRecordId}`;

const cardRequirement = sourceAssetId('requirements', 'carddemo', 'DEMO-MKT-001');
const teamRequirement = (id: string) => sourceAssetId('requirements', 'teams', id);
const marketingDesign = 'docs/design/08-marketing-capability.md';
const marketingIntegration = 'docs/design/adr/ADR-009-marketing-integration.md';
const authenticationScope = 'docs/design/adr/ADR-007-authentication-scope.md';
const localFile = (collection: SourceAssetReference['collection'], path: string, label: string): SourceAssetReference => ({
  collection, path, label, extent: collection === 'graph' ? 'excerpt' : 'full-file', origin: 'existing-local-file',
});
const cardDesignReference = () => localFile('sources', marketingDesign, '阅读已有营销能力设计');
const teamDocumentReference = (path: string, label: string) => localFile('teams-documents', path, label);

type AssetInput = Pick<SourcePluginAsset, 'sourceRecordId' | 'kind' | 'title' | 'summary' | 'detail'> & Partial<Pick<SourcePluginAsset, 'version' | 'updatedAt' | 'references' | 'relatedRequirementIds' | 'requirement' | 'issue'>>;
function asset(data: SourcePluginData, pluginId: SourcePluginId, projectId: SourceProjectId, value: AssetInput): SourcePluginAsset {
  return Object.freeze({
    ...value,
    id: sourceAssetId(pluginId, projectId, value.sourceRecordId), pluginId,
    sourceProjectId: projectId,
    sourceProjectName: projectId === 'teams' ? data.teamsProject.project.name : '信用卡营销交付',
    origin: 'plugin-mock' as const,
    detail: `来源记录 · ${value.sourceRecordId}\n\n${value.detail}`,
    references: Object.freeze((value.references ?? []).map(reference => Object.freeze({ ...reference }))),
    relatedRequirementIds: Object.freeze([...(value.relatedRequirementIds ?? [])]),
  });
}

function repositoryAssets(data: SourcePluginData): readonly SourcePluginAsset[] {
  const card = (value: AssetInput) => asset(data, 'repository', 'carddemo', value);
  const repo = data.teamsProject.project.repos[0];
  return [
    card({
      sourceRecordId: 'carddemo-java-1025', kind: 'repository', title: 'CardDemo Java 项目',
      summary: '信用卡营销交付使用的本地代码仓快照。', version: '本地导入快照',
      detail: '代码仓：carddemo-java-1025\n本地位置：workspace/carddemo-java-1025\n范围：活动中心、交易入账、营销评估和账户返现。\n本插件提供代码仓目录记录；已有源码节选通过各代码资产继续阅读。',
      relatedRequirementIds: [cardRequirement],
    }),
    ...(data.graph ?? []).map(source => card({
      sourceRecordId: `code-${source.id}`, kind: 'code', title: `${source.name} · 源码`,
      summary: source.file, version: '本地源码节选',
      detail: `代码仓：carddemo-java-1025\n文件：${source.file}\n记录引用已有本地源码节选。阅读范围为已导入的节选，未重新读取或修改工作目录。`,
      references: [localFile('graph', source.file, '阅读已有源码节选')], relatedRequirementIds: [cardRequirement],
    })),
    asset(data, 'repository', 'teams', {
      sourceRecordId: 'icode-teams', kind: 'repository', title: repo.name,
      summary: repo.note, version: `源码快照 ${data.teamsProject.sourceCommit.slice(0, 7)}`,
      detail: `项目：${data.teamsProject.project.name}\n代码仓：${repo.name}\n分支：${repo.branch}\n源目录：${repo.path}\n${repo.note}\n记录来自已导入的 Teams 项目快照；引用文件保留原文。`,
      references: [teamDocumentReference('README.md', '阅读仓库 README'), teamDocumentReference('AGENTS.md', '阅读仓库规范 AGENTS.md')],
    }),
  ];
}

function requirementAssets(data: SourcePluginData): readonly SourcePluginAsset[] {
  const reconnect = data.teamsProject.inputs.find(input => input.id === 'D201');
  if (!reconnect) throw new Error('Teams 项目数据缺少 D201 需求依据');
  return [
    asset(data, 'requirements', 'carddemo', {
      sourceRecordId: 'DEMO-MKT-001', kind: 'requirement', title: '信用卡消费返现', version: '需求 r1',
      requirement: { category: 'requirement', owner: '待分配', taskId: 'DEMO-MKT-001' },
      summary: data.blueprint.scenario.slice,
      detail: `需求范围：${data.blueprint.scenario.slice}\n\n已确认：\n1. 目标客户为白金卡客户。\n2. 消费期间为未来 3 个月。\n3. 消费额外返现比例为 0.5%。\n\n待确认：活动日期、周期起算、消费范围与排除项、是否报名、消费门槛、返现上限、结算入账及退款规则。\n\n关联的餐饮设计与历史需求仅为存量参考，不作为本需求已实现或已验证的证据。`,
      references: [cardDesignReference()],
    }),
    ...data.teamsProject.tasks.map(task => asset(data, 'requirements', 'teams', {
      sourceRecordId: `REQ-${task.id}`, kind: 'requirement', title: task.title,
      requirement: { category: task.type === '需求' ? 'requirement' : 'research', owner: '成员 ' + task.owner, plannedEnd: task.due, taskId: task.id },
      summary: task.goal, version: 'Teams 需求快照',
      detail: `依据：已导入 Teams 事项 ${task.id}（${task.type}）。\n目标：${task.goal}\n\n需求标准：\n${task.criteria.map((criterion, index) => `${index + 1}. ${criterion}`).join('\n')}\n\n这里只投影事项的需求定义，不包含交付节点、会话、执行状态或发布结果。`,
    })),
    asset(data, 'requirements', 'teams', {
      sourceRecordId: 'REQ-WINDOWS-RECONNECT', kind: 'requirement', title: reconnect.title,
      requirement: { category: 'issue-input', owner: '成员 C' },
      summary: '重启后恢复 Agent 连接，并区分正常重启与异常退出路径。', version: '需求 r1',
      detail: `依据：已导入 Teams 输入 ${reconnect.id}。\n来源引用：${reconnect.ref}\n\n${reconnect.text}\n\n该需求根据已导入输入整理。`,
    }),
  ];
}

function defectAssets(data: SourcePluginData): readonly SourcePluginAsset[] {
  const reconnect = data.teamsProject.inputs.find(input => input.id === 'D201');
  if (!reconnect) throw new Error('Teams 项目数据缺少 D201 问题依据');
  const web = data.graph?.find(source => source.id === 'web');
  return [
    asset(data, 'defects', 'carddemo', {
      sourceRecordId: 'CARD-BUG-001', kind: 'defect', title: '未报名时应提供餐饮活动报名入口', version: '问题 r1',
      issue: { owner: '陈晨', severity: '未标注', status: '历史已修复', closed: true, confirmed: true, blocksDelivery: false, progress: '已有关联修复；当前处理状态由 Teams 记录补充。' },
      summary: '区分报名动作与消费奖励资格，避免未报名用户无法开始。',
      detail: '问题场景：活动有效、要求报名、用户尚未报名。\n问题描述：若把当前奖励资格不满足直接用作报名按钮禁用条件，用户将无法报名。\n期望行为：展示可执行的报名操作；成功后显示已报名。\n范围说明：本条目根据已有报名问题整理；关联代码已包含修复，保留问题与处理依据。',
      references: [cardDesignReference(), ...(web ? [localFile('graph', web.file, '阅读已有活动中心源码节选')] : [])], relatedRequirementIds: [cardRequirement],
    }),
    asset(data, 'defects', 'carddemo', {
      sourceRecordId: 'CARD-BUG-002', kind: 'defect', title: '重复评估需保持一笔奖励和一次入账', version: '问题 r1',
      issue: { owner: '未分配', severity: '未标注', status: '待复现', closed: null, confirmed: false, blocksDelivery: false, progress: '尚无缺陷复现或关闭记录。' },
      summary: '重复评估的幂等边界待核验。',
      detail: '问题描述：同一活动、同一交易收到重复评估请求。\n期望行为：首次按规则计算奖励；后续请求识别已评估，沿用原奖励标识，避免重复入账。\n复现状态：尚未复现，需结合关联需求与测试用例核验。',
      references: [cardDesignReference(), localFile('sources', marketingIntegration, '阅读已有营销集成决策')], relatedRequirementIds: [cardRequirement],
    }),
    asset(data, 'defects', 'teams', {
      sourceRecordId: 'TEAMS-BUG-001', kind: 'defect', title: reconnect.title, version: 'Teams 问题快照',
      issue: { owner: '成员 C', severity: '未标注', status: '待补复现 · 关闭状态未记录', closed: null, confirmed: true, blocksDelivery: false, progress: 'D201 → R20 讨论中，需补充正常重启和异常退出的复现步骤。' },
      summary: 'Windows 重启后的 Agent 连接恢复问题。',
      detail: `来源依据：Teams 输入 ${reconnect.id}。\n来源引用：${reconnect.ref}\n\n${reconnect.text}\n\n保留来源输入作为问题描述；处理与验证结果待补充。`,
      relatedRequirementIds: [teamRequirement('REQ-WINDOWS-RECONNECT')],
    }),
  ];
}

function designAssets(data: SourcePluginData): readonly SourcePluginAsset[] {
  const cards = [
    { sourceRecordId: 'marketing-capability', title: '营销能力设计', path: marketingDesign, summary: '活动、报名、餐饮返现、奖励及接口设计。' },
    { sourceRecordId: 'ADR-009', title: '营销集成与入账边界', path: marketingIntegration, summary: '交易入账与营销评估之间的调用、提交及重试约定。' },
    { sourceRecordId: 'ADR-007', title: '鉴权范围设计决策', path: authenticationScope, summary: '已有系统的认证范围与限制说明；属于设计资料。' },
  ];
  return [
    ...cards.map(document => asset(data, 'design-library', 'carddemo', {
      sourceRecordId: document.sourceRecordId, kind: 'document', title: document.title, summary: document.summary,
      version: '已有本地文件快照',
      detail: `文档路径：${document.path}\n${document.summary}\n\n插件仅提供文档目录记录；阅读入口返回原有导入文件，未改写正文。`,
      references: [localFile('sources', document.path, `阅读${document.title}`)], relatedRequirementIds: [cardRequirement],
    })),
    ...[{ name: '项目规范 AGENTS.md', path: 'AGENTS.md', description: data.teamsProject.project.agentsNote }, ...data.teamsProject.project.docs].map(document => asset(data, 'design-library', 'teams', {
      sourceRecordId: document.path, kind: 'document', title: document.name, summary: document.description,
      version: `源码快照 ${data.teamsProject.sourceCommit.slice(0, 7)}`,
      detail: `项目：${data.teamsProject.project.name}\n文档路径：${document.path}\n${document.description}\n\n插件记录引用原 Teams 导入快照，阅读入口保留原文。`,
      references: [teamDocumentReference(document.path, `阅读${document.name}`)],
    })),
  ];
}

function testAssets(data: SourcePluginData): readonly SourcePluginAsset[] {
  const titles: Record<string, string> = {
    'AC-01': '白金卡客户范围', 'AC-02': '未来 3 个月消费期间', 'AC-03': '消费额外返现 0.5%',
  };
  const definitions = [
    { id: 'TEAMS-TC-001', requirement: 'REQ-T104', title: '新成员获取项目配置前查看范围', given: '用户已加入团队，项目包含资料与配置。', steps: '打开团队项目，选择待应用配置，查看内容和影响范围。', expected: '展示项目资料、配置内容及作用范围；此处仅定义预期，不记录实际应用结果。' },
    { id: 'TEAMS-TC-002', requirement: 'REQ-T105', title: '切换项目后只显示目标项目内容', given: '两个项目分别拥有不同的资料与来源关联。', steps: '在侧栏依次进入两个项目，再进入一个未关联资产的新项目。', expected: '已有项目显示各自关联；新项目初始为空，不自动继承其他项目数据。' },
    { id: 'TEAMS-TC-003', requirement: 'REQ-T107', title: '工作目录与代码仓身份核对', given: '项目登记了代码仓，本机存在候选工作目录。', steps: '选择匹配目录，再选择不匹配目录，检查页面反馈。', expected: '匹配目录可按合同关联；不匹配目录明确提示，不能默认为已核验。' },
    { id: 'TEAMS-TC-004', requirement: 'REQ-WINDOWS-RECONNECT', title: 'Windows 正常重启与异常退出后的连接恢复', given: 'Windows 环境已接入一个 Agent 实例。', steps: '分别使用正常重启和异常退出的独立场景，再启动客户端检查连接提示。', expected: '呈现真实连接状态与可执行的下一步；此用例定义不代表已运行或验证通过。' },
  ];
  return [
    ...data.blueprint.acceptance_criteria.filter(criterion => criterion.id in titles).map(criterion => asset(data, 'test-assets', 'carddemo', {
      sourceRecordId: `CARD-TC-${criterion.id.slice(3)}`, kind: 'test-case', title: titles[criterion.id],
      summary: criterion.given, version: '用例 v1',
      detail: `用例依据：验收标准 ${criterion.id}。\n前置条件 / 输入：${criterion.given}\n操作：按已确认的需求范围核对；具体执行步骤待业务细则明确后补充。\n预期结果：${criterion.expected}\n\n本记录是测试用例定义，不包含测试运行、测试报告或验收结论。`,
      references: [cardDesignReference()], relatedRequirementIds: [cardRequirement],
    })),
    ...definitions.map(definition => asset(data, 'test-assets', 'teams', {
      sourceRecordId: definition.id, kind: 'test-case', title: definition.title, summary: definition.given,
      version: '用例 v1',
      detail: `前置条件：${definition.given}\n操作步骤：${definition.steps}\n预期结果：${definition.expected}\n\n此为测试用例定义，未执行测试。`,
      relatedRequirementIds: [teamRequirement(definition.requirement)],
    })),
  ];
}

const provider = (id: SourcePluginId, kinds: readonly SourceAssetKind[], provide: SourcePluginProvider['provide']): SourcePluginProvider => Object.freeze({
  id, name: externalPlatforms.find(platform => platform.id === id)!.name, kinds: Object.freeze([...kinds]), provide,
});

/** Five raw source providers; Talent knowledge is supplied explicitly by its HTTP API. */
export const sourcePluginProviders: readonly SourcePluginProvider[] = Object.freeze([
  provider('repository', ['repository', 'code'], repositoryAssets),
  provider('requirements', ['requirement'], requirementAssets),
  provider('defects', ['defect'], defectAssets),
  provider('design-library', ['document'], designAssets),
  provider('test-assets', ['test-case'], testAssets),
  provider('business-knowledge', ['knowledge'], data => {
    const records = data.talentKnowledgeAssets ?? [];
    if (records.some(record => record.pluginId !== 'business-knowledge' || record.kind !== 'knowledge')) throw new Error('Talent 知识来源类型无效');
    return records;
  }),
]);

export function createSourcePluginCatalog(data: SourcePluginData): SourcePluginCatalog {
  const records = sourcePluginProviders.flatMap(plugin => [...plugin.provide(data)]);
  const byId = new Map<string, SourcePluginAsset>();
  for (const record of records) {
    if (byId.has(record.id)) throw new Error(`源插件记录 ID 重复：${record.id}`);
    byId.set(record.id, record);
  }
  for (const record of records) for (const requirementId of record.relatedRequirementIds) {
    const requirement = byId.get(requirementId);
    if (!requirement || requirement.pluginId !== 'requirements' || requirement.sourceProjectId !== record.sourceProjectId) throw new Error(`源插件需求关联无效：${record.id} → ${requirementId}`);
  }
  return Object.freeze({
    plugins: sourcePluginProviders,
    list: (filter: SourceAssetFilter = {}) => Object.freeze(records.filter(record => (!filter.pluginId || record.pluginId === filter.pluginId) && (!filter.sourceProjectId || record.sourceProjectId === filter.sourceProjectId))),
    get: (assetId: string) => byId.get(assetId),
    readReference(reference: SourceAssetReference) {
      if (reference.collection === 'sources') return data.sources.find(source => source.file === reference.path)?.content;
      if (reference.collection === 'teams-documents') return data.teamsProject.documents.find(document => document.path === reference.path)?.content;
      if (reference.collection === 'graph') return data.graph?.find(source => source.file === reference.path)?.excerpt;
      return undefined;
    },
  });
}
