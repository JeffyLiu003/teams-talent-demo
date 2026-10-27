/** Demo sources only. These definitions do not connect to external platforms. */
export const externalPlatforms = [
  { id: 'repository', name: '代码托管平台', dataTypes: ['代码'], description: 'CardDemo 代码仓与版本快照。' },
  { id: 'requirements', name: '需求平台', dataTypes: ['需求'], description: '业务需求、范围与验收标准。' },
  { id: 'defects', name: '缺陷平台', dataTypes: ['问题单', '缺陷'], description: '问题单、缺陷描述与处理状态。' },
  { id: 'design-library', name: '设计文档 / 知识库', dataTypes: ['设计', '原始资料'], description: '原始设计文档、接口约定与业务说明。' },
  { id: 'test-assets', name: '测试资产平台', dataTypes: ['测试用例'], description: '客户资格、周期边界、金额精度与重复处理的测试用例。' },
] as const;
export function externalPlatformDefault(id: string) {
  const source = externalPlatforms.find(item => item.id === id);
  return source ? { id: source.id, name: source.name, kind: 'asset', enabled: true, description: source.description } : undefined;
}
