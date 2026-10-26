# ADR-003: 数据所有权与"每服务一库"

| 项 | 内容 |
|----|------|
| 编号 | ADR-003 |
| 日期 | 2026-10-25 |
| 状态 | 已接受 |
| 关联需求 | ADR-001；`docs/design/06-traceability-matrix.md` |

## 背景

遗留系统中多个程序直接跨文件读写：`COACTUPC` 同时更新 ACCTDAT 与 CUSTDAT；`CBTRN02C` 直接
更新 ACCTDAT 与 TCATBALF；`COPAUA0C` 直接读 ACCTDAT/CUSTDAT/CCXREF。微服务化后，若仍允许
跨库直连，将重新形成"分布式单体"。必须明确每张表的唯一属主。

## 候选方案

| 方案 | 描述 | 优点 | 缺点 |
|---|---|---|---|
| 方案A：每服务独立数据库 | 6 个 PostgreSQL database，禁止跨库访问 | 边界强制；可独立迁移/扩容/回滚 | 跨域查询需 API 组合；一致性问题前移 |
| 方案B：共享库、按 schema 隔离 | 单库多 schema | 迁移简单；可跨 schema 查询 | 边界软化，易被绕过；锁竞争与版本耦合 |
| 方案C：共享库共享表 | 沿用遗留单库 | 最省事 | 无法独立部署；违背微服务目标 |

## 量化权衡表

| 方案 | 实现成本 | 性能开销 | 运维时效 | 审计性 | 风险 |
|---|---|---|---|---|---|
| A | 中（6 库 + 初始化脚本） | 中（跨域查询走 HTTP） | 单服务可独立回滚 | 高（数据责任清晰） | 中（一致性） |
| B | 低 | 低 | 需共享库变更窗口 | 中 | 中高（边界腐化） |
| C | 最低 | 最低 | 整体发布 | 低 | 高 |

## 决策

采用方案 A：`carddemo_iam`、`carddemo_customer`、`carddemo_card`、`carddemo_account`、
`carddemo_transaction`、`carddemo_authorization` 六个独立数据库，服务间只通过 REST 交互。

## 理由

1. 聚合根与表的对应关系稳定（见数据字典），每个表只有一个写入方。
2. 遗留系统中"跨文件事务"集中在少数用例（账户+客户维护、账单支付、入账），已由 ADR-004/005 明确编排归属。
3. 演示环境用单 PostgreSQL 实例承载 6 个 database，运维成本可控，同时保留"逻辑隔离"。

## 后果（影响与回退路径）

- 影响：组合查询（账户视图、授权决策）需多次 HTTP 调用；报表只能读取事务库。
- 回退：若必须联合查询，可引入只读数据同步（CDC → 查询库），而不是恢复跨库直连。

## 证据

- `COACTUPC.cbl:3888-4104`（跨 ACCTDAT/CUSTDAT 写）
- `CBTRN02C.cbl:424-559`（跨 ACCTDAT/TCATBALF/TRANSACT 写）
- `COPAUA0C.cbl:448-457`（跨 CCXREF/ACCTDAT/CUSTDAT 读）
