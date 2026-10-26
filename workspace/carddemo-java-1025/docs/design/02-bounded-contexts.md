# 限界上下文定义

## 1. 上下文清单

> 说明：`web-ui`（业务界面 + 同源代理）是**表现层**，不属于任何限界上下文，不拥有数据与业务规则。

| 上下文 | 类型 | 服务 | 数据库 | 拥有的聚合 |
|---|---|---|---|---|
| 身份与访问（IAM） | 通用域 | iam-service :8081 | `carddemo_iam` | SecUser |
| 客户（Customer） | 支撑域 | customer-service :8082 | `carddemo_customer` | Customer |
| 卡片（Card） | 核心域 | card-service :8083 | `carddemo_card` | Card、CardXref |
| 账户（Account） | 核心域 | account-service :8084 | `carddemo_account` | Account |
| 交易与账务（Transaction） | 核心域 | transaction-service :8085 | `carddemo_transaction` | TransactionRecord、TranCategoryBalance、TranType、TranCategory、DisclosureGroup |
| 授权（Authorization） | 核心域 | authorization-service :8086 | `carddemo_authorization` | AuthorizationCase、PendingAuthorizationSummary、CardFraudFlag |
| 营销（Marketing） | 支撑域（新增） | marketing-service :8087 | `carddemo_marketing` | Campaign、Enrollment、RewardGrant |

## 2. 各上下文职责与边界

### 2.1 IAM（iam-service）

- **职责**：登录鉴别、用户增删改查、用户类型（A/U）与菜单分流、token 签发。
- **聚合**：`SecUser`（用户号、姓名、密码哈希、类型、版本）。
- **不变量**：用户号 8 位唯一；类型 ∈ {A,U}；至少保留一个管理员；不能删除自己（可选 `X-User-Id`）。
- **对外契约**：`/api/v1/auth/*`、`/api/v1/users/*`。
- **明确不属于本上下文**：业务权限（菜单项级）、会话管理（无状态 HTTP）、单点登录。
- **遗留映射**：COSGN00C、COADM01C、COMEN01C（仅菜单项数据）、COUSR00C–03C。
- **安全决策**：ADR-007（token 不强制校验）、ADR-008（PBKDF2）。

### 2.2 Customer（customer-service）

- **职责**：客户主数据（姓名、地址、联系方式、SSN、DOB、FICO、EFT、主卡标志）。
- **不变量**：见 BR-CUST-02..12。
- **对外契约**：`GET/POST/PUT /api/v1/customers`。
- **不属于**：账户额度、卡片状态、客户与账户的归属关系（由 card-service 的 Xref 维护）。
- **遗留映射**：CUSTDAT、CBCUS01C、COACTUPC 的客户部分、CBEXPORT/CBIMPORT 的 C 记录。
- **数据最小化**：响应只返回 SSN 掩码；不返回完整 SSN。

### 2.3 Card（card-service）

- **职责**：卡片主数据、卡号↔账户↔客户映射（Xref）、卡列表/详情/维护、按账户查卡。
- **不变量**：见 BR-CARD-01..11、NR-CARD-01/02。
- **对外契约**：`/api/v1/cards`、`/api/v1/cards/by-account/{accountId}`。
- **不属于**：额度与余额（Account）、授权决策（Authorization）、客户资料（Customer）。
- **遗留映射**：CARDDAT、CCXREF、CXACAIX、COCRDLIC/SLC/UPC、CBACT02C、CBACT03C。

### 2.4 Account（account-service）

- **职责**：账户主数据、余额与额度、记账（posting）、还款（payment）、利息入账（interest accrual）。
- **不变量**：见 BR-ACCT-02..06、NR-ACCT-01。
- **对外契约**：`/api/v1/accounts`。
- **不属于**：交易主档（Transaction）、授权占用（Authorization）、客户资料（Customer）。
- **遗留映射**：ACCTDAT、COACTVWC、COACTUPC（账户部分）、CBTRN02C 的账户更新段、CBACT04C 的账户结算、COBIL00C 的扣款段。

### 2.5 Transaction（transaction-service）

- **职责**：交易主档、交易类型/类别参照数据、类别累计、日终入账、利息计提、账单支付编排、交易报表。
- **不变量**：见 BR-TRN-*、BR-POST-*、BR-INT-*、BR-BILL-*。
- **对外契约**：`/api/v1/transactions`、`/api/v1/postings`、`/api/v1/interest-runs`、
  `/api/v1/bill-payments`、`/api/v1/reports/transactions`、`/api/v1/transaction-types`。
- **不属于**：账户余额的最终权威（Account）、卡片状态（Card）、授权决策（Authorization）。
- **遗留映射**：TRANSACT、DALYTRAN、TCATBALF、TRANTYPE、TRANCATG、DISCGRP、COTRN00C/01C/02C、CBTRN01C/02C/03C、CBACT04C、COBIL00C、CORPT00C。

### 2.6 Authorization（authorization-service）

- **职责**：授权决策、待授权汇总与明细、卡级欺诈标记、过期授权清理。
- **不变量**：见 BR-AUTH-01..13、NR-AUTH-01/02。
- **对外契约**：`/api/v1/authorizations`、`/api/v1/pending-authorizations/{accountId}`、
  `/api/v1/authorization-purges`。
- **不属于**：账户余额与额度（只读取快照）、交易入账（授权批准不等于入账）、客户资料。
- **遗留映射**：COPAUA0C、COPAUS0C/1C/2C、CBPAUP0C、IMS PAUTSUM0/PAUTDTL1、DB2 AUTHFRDS。

### 2.7 Marketing（marketing-service，新增）

- **职责**：活动配置与生命周期、报名、消费奖励评估（返现/积分）、奖励发放与重试、活动效果统计。
- **聚合**：`Campaign`（活动，状态机 DRAFT→ACTIVE⇄PAUSED→ENDED）、`Enrollment`（报名）、
  `RewardGrant`（奖励发放，幂等键 campaignId+transactionId）。
- **不变量**：见 `08-marketing-capability.md` §2 与 MK-* 规则；预算不可超发；同一交易同一活动只发一次。
- **对外契约**：`/api/v1/campaigns`、`/api/v1/eligibilities`、`/api/v1/reward-evaluations`、
  `/api/v1/rewards`、`/api/v1/marketing/summary`。
- **不属于**：账户余额（只读快照，返现由 Account 执行）、交易账本、卡片状态、客户资料。
- **集成**：Transaction 入账成功后同步调用评估（失败只告警）；返现调 Account 幂等入账。见 ADR-009。
- **遗留映射**：无（存量系统不具备营销能力）。

## 3. 跨上下文协作（谁问谁答）

| 场景 | 发起方 | 依赖 | 数据流向 |
|---|---|---|---|
| 交易录入 | Transaction | Card | 卡号 → 账户/客户 |
| 入账 | Transaction | Card、Account | 校验卡与账户；写账户余额 |
| 账单支付 | Transaction | Account、Card | 读余额；写交易；扣款 |
| 利息 | Transaction | Account | 写利息交易；余额与账期结算 |
| 授权决策 | Authorization | Card、Account、Customer | 读卡/账户/客户快照；写本地授权汇总 |
| 奖励评估 | Transaction → Marketing | Account | 入账后传交易快照；Marketing 读账户组并把返现写回 Account |
| 活动中心/奖励 | Web UI → Marketing | Account | 读账户快照判断资格；读本地报名与奖励 |
| 交易报表 | Transaction | — | 只读本地交易与参照数据 |
| 账户视图 | 调用方（UI/BFF） | Account、Customer、Card | 三次查询组合 |

## 4. 哪些遗留职责被合并/移动

| 遗留职责 | 新归属 | 说明 |
|---|---|---|
| `CXACAIX` 账户→客户/卡查询 | Card | Xref 是卡片上下文的映射数据 |
| 交易列表按卡号过滤 | Transaction（本地有 `card_number`） | 无需调用 Card |
| 报表按卡号分组 | Transaction | 交易主档已含卡号 |
| 交易类型维护 | Transaction | 参照数据属于交易语义 |
| 分行迁移导入导出 | 独立迁移工具（本期不实现） | 一次性实施工具，不是业务能力 |
| MQ 账户查询 | Account 的 HTTP API + 适配器（延后） | 契约等价 |

## 5. 上下文边界的验收方式

1. 数据库层：服务账号只能访问自己的 database（Compose 中每个服务独立连接串）。
2. 代码层：`domain` 包不得出现 `RestClient`/`JdbcTemplate` 以外跨上下文实体引用。
3. 契约层：跨上下文只使用 `docs/design/05-api-catalog.md` 中的 DTO，不共享 JPA 实体。
4. 测试层：每个服务的端到端测试只依赖自身数据库与 Mock 的下游。
