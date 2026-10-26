/** Demo sources only. These definitions do not connect to external platforms. */
export const externalPlatforms = [
  { id: 'repository', name: '代码托管平台', dataTypes: ['代码'], description: 'CardDemo 代码仓与版本快照。' },
  { id: 'requirements', name: '需求平台', dataTypes: ['需求'], description: '业务需求、范围与验收标准。' },
  { id: 'defects', name: '缺陷平台', dataTypes: ['问题单', '缺陷'], description: '问题单、缺陷描述与处理状态。' },
  { id: 'design-library', name: '设计文档 / 知识库', dataTypes: ['设计', '原始资料'], description: '原始设计文档、接口约定与业务说明。' },
  { id: 'test-assets', name: '测试资产平台', dataTypes: ['测试用例'], description: '报名、返现门槛、封顶与重复评估的测试用例。' },
  { id: 'business-knowledge', connectionId: 'talent', name: '业务知识（Talent）', dataTypes: ['知识资产'], description: 'Talent 提供已构建的业务知识资产，供项目查看与采用。' },
] as const;
export function externalPlatformDefault(id: string) {
  const source = externalPlatforms.find(item => item.id === id);
  return source ? { id: 'connectionId' in source ? source.connectionId : source.id, name: source.name, kind: 'connectionId' in source ? 'talent' : 'asset', enabled: true, description: source.description } : undefined;
}
