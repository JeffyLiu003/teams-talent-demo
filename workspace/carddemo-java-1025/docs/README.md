# 文档索引

## 1. 存量知识（As-Is）

| 文档 | 内容 |
|---|---|
| [legacy/01-codebase-inventory.md](legacy/01-codebase-inventory.md) | 44 个程序、copybook、数据存储、JCL、接口、风险量化 |
| [legacy/02-five-level-model.md](legacy/02-five-level-model.md) | L1–L5 五层业务模型（每条事实带证据）、迁移影响、BCP、未解决项 |
| [legacy/03-business-rule-catalog.md](legacy/03-business-rule-catalog.md) | 业务规则目录：遗留证据 → 目标落点 → 实现状态 |
| [legacy/04-data-dictionary.md](legacy/04-data-dictionary.md) | 14 个逻辑实体的字段级数据字典与枚举 |
| [legacy/05-ubiquitous-language.md](legacy/05-ubiquitous-language.md) | 统一语言词汇表、术语冲突与消歧 |

## 2. 目标设计（To-Be）

| 文档 | 内容 |
|---|---|
| [design/01-domain-analysis.md](design/01-domain-analysis.md) | 子域划分、聚合与不变量、领域服务/事件、语义差异 |
| [design/02-bounded-contexts.md](design/02-bounded-contexts.md) | 6 个限界上下文的职责、边界、数据所有权 |
| [design/03-service-decomposition.md](design/03-service-decomposition.md) | 服务拆分、调用矩阵、失败语义、部署与容量 |
| [design/04-context-map.md](design/04-context-map.md) | 上下文映射图、集成契约、防腐层 |
| [design/05-api-catalog.md](design/05-api-catalog.md) | 全部 REST 契约、种子数据契约、错误码总表 |
| [design/06-traceability-matrix.md](design/06-traceability-matrix.md) | 遗留程序 → 服务 → 接口 → 规则 → 测试 |
| [design/07-java-conventions.md](design/07-java-conventions.md) | 编码/分层/配置/测试统一基线 |
| [design/08-marketing-capability.md](design/08-marketing-capability.md) | 营销能力：场景、领域模型、规则、前后台改造 |
| [design/adr/README.md](design/adr/README.md) | 9 个架构决策记录（MADR） |

## 3. 运维

| 文档 | 内容 |
|---|---|
| [ops/01-docker-runbook.md](ops/01-docker-runbook.md) | 构建、启动、调试、排障、重置、安全缺口 |
