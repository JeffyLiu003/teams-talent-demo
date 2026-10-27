import type { Presentation } from '../src/api.js';
import { createSourcePluginCatalog, type SourcePluginAsset } from '../src/source-plugins.js';
import { legacyAssetSourceIds } from '../src/project-asset-links.js';
import type { TalentProjectContext } from '../src/talent-contract.js';

const rules = [
  { id: 'K-01', title: '白金卡资格独立判断', text: '先检查卡片等级。普通卡不进入白金卡额外返现计算。', file: 'demo/docs/cashback-contract.md' },
  { id: 'K-02', title: '同一交易只奖励一次', text: '同一交易不得重复写入，重复处理不能改变奖励条数或余额。', file: 'demo/docs/cashback-integration.md' },
  { id: 'K-03', title: '三个月期间边界', text: '按已配置期间核对消费时间，开始包含、结束不包含；正式起止日期仍需确认。', file: 'demo/docs/cashback-contract.md' },
  { id: 'K-04', title: '额外0.5%以整数分计算', text: '120.00元额外返现0.60元；半分向上舍入至整分，拒绝非正金额。正式舍入及其他业务细则需确认。', file: 'demo/docs/cashback-contract.md' },
];
export function buildMockKnowledge(context: TalentProjectContext, fixtures: Presentation): SourcePluginAsset[] {
  const catalog = createSourcePluginCatalog(fixtures), at = new Date().toISOString();
  const inputs = context.assets.flatMap(asset => legacyAssetSourceIds(asset).map(id => catalog.get(id)).filter((asset): asset is SourcePluginAsset => !!asset));
  const make = (id: string, title: string, summary: string, references: SourcePluginAsset['references']): SourcePluginAsset => ({
    id: `business-knowledge:${context.id}:${id}`, pluginId: 'business-knowledge', sourceRecordId: id, kind: 'knowledge', title, summary,
    detail: `Talent 项目知识 · ${id}\n项目：${context.name}\n版本：knowledge-v1\n\n${summary}\n\n本条目基于已关联资料整理；模型抽取与全仓代码构图尚未执行。已有本地原文按引用阅读，原文不属于派生知识正文。`,
    sourceProjectId: context.id, sourceProjectName: context.name, origin: 'plugin-mock', version: 'knowledge-v1', updatedAt: at,
    references, relatedRequirementIds: context.id === 'carddemo' ? ['requirements:carddemo:DEMO-MKT-001'] : [],
  });
  if (context.id === 'carddemo') return rules.filter(rule => inputs.some(input => input.references.some(reference => reference.path === rule.file))).map(rule => make(rule.id, rule.title, rule.text, [{ collection: 'sources', path: rule.file, label: '阅读原始业务资料', extent: 'full-file', origin: 'existing-local-file' }]));
  return context.assets.map((asset, index) => {
    const source = inputs.find(source => legacyAssetSourceIds(asset).includes(source.id));
    return make(`INDEX-${index + 1}`, `${asset.title} · 来源索引`, `已为所选输入「${asset.title}」生成可追溯索引。位置：${asset.location}。此索引仅记录来源；项目业务知识仍需后续抽取与确认。`, source?.references ?? []);
  });
}
