import type { Presentation } from '../src/api.js';
import { createSourcePluginCatalog, type SourcePluginAsset } from '../src/source-plugins.js';
import { legacyAssetSourceIds } from '../src/project-asset-links.js';
import type { TalentProjectContext } from '../src/talent-contract.js';

const rules = [
  { id: 'K-01', title: '报名与资格分别判断', text: '将尚未报名的下一步操作与最终返现资格分开建模，保留过期、暂停和权限限制。', file: 'docs/design/08-marketing-capability.md' },
  { id: 'K-02', title: '同一交易只奖励一次', text: '活动与交易识别重复评估；账户服务以 rewardId 处理重复入账请求。', file: 'docs/design/adr/ADR-009-marketing-integration.md' },
  { id: 'K-03', title: '失败奖励保留重试身份', text: '账户暂不可用时奖励保持 PENDING，后续重试沿用原 rewardId。', file: 'docs/design/adr/ADR-009-marketing-integration.md' },
  { id: 'K-04', title: '返现受门槛与上限约束', text: '餐饮类别 0001，消费满 50 元返 5%，单笔最多 30 元，每卡最多 5 次。', file: 'docs/design/08-marketing-capability.md' },
];
export function buildMockKnowledge(context: TalentProjectContext, fixtures: Presentation): SourcePluginAsset[] {
  const catalog = createSourcePluginCatalog(fixtures), at = new Date().toISOString();
  const inputs = context.assets.flatMap(asset => legacyAssetSourceIds(asset).map(id => catalog.get(id)).filter((asset): asset is SourcePluginAsset => !!asset));
  const make = (id: string, title: string, summary: string, references: SourcePluginAsset['references']): SourcePluginAsset => ({
    id: `business-knowledge:${context.id}:${id}`, pluginId: 'business-knowledge', sourceRecordId: id, kind: 'knowledge', title, summary,
    detail: `Talent 构建的演示知识 · ${id}\n项目：${context.name}\n版本：knowledge-v1\n\n${summary}\n\n本条目由明确的 mock 构建生成，未运行模型抽取或全仓代码构图。已有本地原文按引用阅读，原文不属于派生知识正文。`,
    sourceProjectId: context.id, sourceProjectName: context.name, origin: 'plugin-mock', version: 'knowledge-v1', updatedAt: at,
    references, relatedRequirementIds: context.id === 'carddemo' ? ['requirements:carddemo:DEMO-MKT-001'] : [],
  });
  if (context.id === 'carddemo') return rules.filter(rule => inputs.some(input => input.references.some(reference => reference.path === rule.file))).map(rule => make(rule.id, rule.title, rule.text, [{ collection: 'sources', path: rule.file, label: '阅读原始业务资料', extent: 'full-file', origin: 'existing-local-file' }]));
  return context.assets.map((asset, index) => {
    const source = inputs.find(source => legacyAssetSourceIds(asset).includes(source.id));
    return make(`INDEX-${index + 1}`, `${asset.title} · 来源索引`, `已为所选输入「${asset.title}」生成可追溯索引。位置：${asset.location}。此演示索引不推断业务规则；项目业务知识仍需后续抽取与确认。`, source?.references ?? []);
  });
}
