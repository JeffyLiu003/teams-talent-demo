# 需求—设计—实现追踪矩阵（遗留程序 → 微服务）

> 状态：`已实现` = 新服务提供等价能力并有测试；`部分` = 语义保留但界面/排版/批处理形态改变；
> `延后` = 本期不实现且已说明理由；`替代` = 由平台能力替代。
> 规则编号见 `docs/legacy/03-business-rule-catalog.md`；接口见 `docs/design/05-api-catalog.md`。

## 1. 在线程序（24）

| 遗留程序 | 功能 | 目标服务 | 目标接口 / 类 | 规则 | 状态 |
|---|---|---|---|---|---|
| COSGN00C | 登录与菜单分流 | iam | `POST /api/v1/auth/login`、`/auth/verify` | BR-SGN-01..05、ADR-008 | 已实现 |
| COADM01C | 管理员菜单 | iam | `GET/POST/PUT/DELETE /api/v1/users`（菜单项由前端渲染） | BR-USER-* | 已实现 |
| COMEN01C | 普通用户菜单 | iam + 各服务 | 菜单项由前端根据 `landingMenu` 渲染 | — | 部分（菜单数据由前端维护） |
| COUSR00C | 用户列表 | iam | `GET /api/v1/users` | BR-USER-05 | 已实现 |
| COUSR01C | 用户新增 | iam | `POST /api/v1/users` | BR-USER-01..04 | 已实现 |
| COUSR02C | 用户修改 | iam | `PUT /api/v1/users/{userId}` | BR-USER-06、BR-USER-04 | 已实现 |
| COUSR03C | 用户删除 | iam | `DELETE /api/v1/users/{userId}` | BR-USER-07、NR-USER-01/02 | 已实现 |
| COACTVWC | 账户视图（账户+客户） | account + customer + card | `GET /accounts/{id}` + `GET /customers/{cid}` + `GET /cards/by-account/{aid}` | BR-ACCT-07/08、BR-CARD-05 | 已实现（组合查询） |
| COACTUPC | 账户+客户维护 | account + customer | `PUT /accounts/{id}`、`PUT /customers/{id}` | BR-ACCT-01..06、BR-CUST-02..12 | 已实现（拆两个用例） |
| COCRDLIC | 卡片列表（7 行分页） | card | `GET /api/v1/cards?page&size=7` | BR-CARD-02..04 | 已实现（offset 分页） |
| COCRDSLC | 卡片详情 | card | `GET /api/v1/cards/{cardNumber}` | BR-CARD-05/06 | 已实现 |
| COCRDUPC | 卡片维护 | card | `PUT /api/v1/cards/{cardNumber}` | BR-CARD-07..11、NR-CARD-01/02 | 已实现 |
| COTRN00C | 交易列表（10 行分页） | transaction | `GET /api/v1/transactions` | BR-TRN-09 | 已实现 |
| COTRN01C | 交易详情 | transaction | `GET /api/v1/transactions/{id}` | BR-TRN-10 | 已实现 |
| COTRN02C | 交易录入 | transaction | `POST /api/v1/transactions` | BR-TRN-01..08 | 已实现 |
| COBIL00C | 账单支付 | transaction + account | `POST /api/v1/bill-payments` → `POST /accounts/{id}/payments` | BR-BILL-01..05、NR-ACCT-01 | 已实现 |
| CORPT00C | 报表参数与提交 | transaction | `GET /api/v1/reports/transactions` | BR-RPT-01..03 | 部分（不生成 JCL） |
| COPAUA0C | 授权决策 | authorization | `POST /api/v1/authorizations` | BR-AUTH-01..11 | 已实现 |
| COPAUS0C | 待授权汇总视图 | authorization | `GET /api/v1/pending-authorizations/{accountId}` | BR-AUTH-12 | 已实现 |
| COPAUS1C | 授权明细视图 | authorization | `GET /api/v1/authorizations/{id}` | BR-AUTH-12 | 已实现 |
| COPAUS2C | 标记授权欺诈 | authorization | `POST /api/v1/authorizations/{id}/fraud` | BR-AUTH-12、BR-AUTH-06 | 已实现 |
| COTRTLIC | 交易类型/类别列表 | transaction | `GET /api/v1/transaction-types`、`/transaction-categories` | BR-TT-01 | 部分（只读 + 类型描述维护） |
| COTRTUPC | 交易类型/类别维护 | transaction | `PUT /api/v1/transaction-types/{code}` | BR-TT-01 | 部分（类别增删延后） |
| COBTUPDT | 交易类型更新（DB2） | transaction | 同上 | BR-TT-01 | 部分 |

## 2. 批处理与工具程序（20）

| 遗留程序 | 功能 | 目标服务 / 替代 | 规则 | 状态 |
|---|---|---|---|---|
| CBTRN02C | 日终入账 | transaction `POST /api/v1/postings` + account `postings` | BR-POST-01..08、NR-POST-01 | 已实现 |
| CBTRN01C | 日交易校验（只读） | transaction `POST /api/v1/postings` 的校验阶段 | BR-POST-01..04 | 已实现（不再单独打印） |
| CBTRN03C | 交易明细报表 | transaction `GET /api/v1/reports/transactions` | BR-RPT-01..05 | 部分（JSON 化，无 133 字节排版） |
| CBACT04C | 利息计提 | transaction `POST /api/v1/interest-runs` + account `interest-accruals` | BR-INT-01..04 | 已实现 |
| CBPAUP0C | 过期授权清理 | authorization `POST /api/v1/authorization-purges` | BR-AUTH-13、NR-AUTH-01/02 | 已实现 |
| CBSTM03A | 对账单生成（文本+HTML） | — | — | 延后（报表平台，U5） |
| CBSTM03B | 对账单排版子程序 | — | — | 延后 |
| CBEXPORT | 分行迁移导出 | 迁移工具 | BR-MIG-01 | 延后 |
| CBIMPORT | 分行迁移导入 | 迁移工具 + customer `POST` | BR-MIG-02 | 延后 |
| DBUNLDGS | IMS 卸载到 GSAM | 迁移工具 | — | 延后 |
| PAUDBUNL | IMS 授权库卸载 | 迁移工具（只迁近 5 天，U2） | — | 延后 |
| PAUDBLOD | IMS 授权库装载 | 迁移工具 | — | 延后 |
| CBACT01C | 账户打印 | account `GET /accounts` + 运维导出 | — | 部分（打印由运维工具实现） |
| CBACT02C | 卡片打印 | card `GET /cards` + 运维导出 | — | 部分 |
| CBACT03C | 交叉引用打印 | card `GET /cards` | — | 部分 |
| CBCUS01C | 客户打印 | customer `GET /customers` | — | 部分 |
| CSUTLDTC | 日期校验子程序 | `java.time` + DTO 校验 | BR-ACCT-04、BR-TRN-06 | 替代 |
| COBSWAIT | 批处理等待 | 不需要（JCL 调度替代） | — | 替代 |
| COACCT01 / CODATE01 | MQ 账户/日期查询 | account `GET /accounts/{id}`（MQ 适配器延后） | BR-MQ-01/02 | 部分 |

> 说明：`COBSWAIT` 与 `CSUTLDTC` 的能力由平台/语言替代，不单独建服务；打印类程序的**数据口径**
> 已由查询 API 覆盖，纸质排版不迁移（U5）。

## 3. 规则 → 实现 → 测试

| 规则组 | 实现类 | 测试 |
|---|---|---|
| BR-SGN-01..05、NR-USER-01/02 | `iam.application.AuthenticationService`、`UserDirectoryService` | `AuthenticationServiceTest`、`UserControllerTest` |
| BR-USER-01..07 | `UserDirectoryService` | `UserDirectoryServiceTest`、`UserControllerTest` |
| BR-CUST-02..12、NR-CUST-01 | `CustomerService`、`domain.model.Customer` | `CustomerTest`、`CustomerControllerTest` |
| BR-CARD-01..11、NR-CARD-01/02 | `CardService`、`domain.model.Card` | `CardTest`、`CardControllerTest` |
| BR-ACCT-02..06、BR-ACCT-09..11、NR-ACCT-01 | `AccountApplicationService`、`Account` | `AccountTest`、`AccountControllerTest` |
| BR-TRN-01..08、BR-POST-01..08、NR-POST-01 | `TransactionApplicationService`、`PostingService`、`PostingPolicy` | `PostingPolicyTest`、`TransactionControllerTest` |
| BR-INT-01..04 | `InterestService`、`InterestCalculator` | `InterestCalculatorTest`、`InterestServiceTest` |
| BR-BILL-01..05 | `BillPaymentService` | `BillPaymentServiceTest` |
| BR-RPT-01..04 | `TransactionReportService` | `TransactionReportServiceTest` |
| BR-AUTH-01..13、NR-AUTH-01/02/03 | `AuthorizationService`、`AuthorizationPolicy`、`AuthorizationPurgeService` | `AuthorizationPolicyTest`、`AuthorizationControllerTest` |

## 5. 新增能力：信用卡营销（营销上下文）

> 存量 CardDemo 无营销能力，本次为新增能力，不涉及遗留程序迁移。设计与规则见
> `docs/design/08-marketing-capability.md`；集成决策见 ADR-009。

| 能力 | 目标服务 / 接口 | 规则 | 测试 |
|---|---|---|---|
| 活动创建与生命周期 | marketing `POST/PUT /campaigns`、`/{id}/activate|pause|end` | MK-CAM-01..06 | `CampaignTest` |
| 资格判定 | marketing `GET /eligibilities`、`EligibilityPolicy` | MK-ELI-01..09 | `EligibilityPolicyTest` |
| 报名 | marketing `POST /campaigns/{id}/enrollments` | MK-ENR-01..03 | `MarketingApiTest` |
| 奖励计价 | `RewardCalculator`（固定/比例封顶/积分倍数） | MK-REW-02 | `RewardCalculatorTest` |
| 奖励评估与幂等 | marketing `POST /reward-evaluations` | MK-REW-01/03..08 | `RewardEvaluationServiceTest`、`MarketingApiTest` |
| 返现入账与幂等 | account `POST /accounts/{id}/cashback-credits` | NR-REWARD-01 | `AccountTest`、`AccountControllerTest` |
| 失败重试 | marketing `POST /rewards/{id}/fulfill` | MK-REW-07 | `RewardEvaluationServiceTest` |
| 入账触发营销 | transaction `PostingService` → `MarketingClient` | ADR-009（失败不回滚） | `PostingServiceTest` |
| 活动效果 | marketing `GET /campaigns/{id}/performance`、`/marketing/summary` | MK-QRY-01..03 | `MarketingApiTest` |
| 前台活动中心/奖励/活动管理 | web-ui `#/offers`、`#/rewards`、`#/campaigns` | — | jsdom 界面端到端（9/9） |

## 6. 覆盖度自检

| 检查项 | 结果 |
|---|---|
| 44 个遗留程序是否都有去向 | 44/44（24 在线 + 20 批处理/工具，见 §1/§2） |
| 核心域程序（授权/入账/利息/账单支付/账户维护）是否等价实现 | 5/5 |
| 新增营销能力的场景/规则/接口/测试是否闭环 | 10 项能力全部有实现与测试（见 §5） |
| 每条已声明的业务规则是否有实现或明确延后理由 | 100% |
| 每项延后是否需要业务确认 | 是（U4 商户欺诈、U5 报表排版、BR-MIG、BR-MQ、BR-INT-05 费用） |
| 是否存在未追踪的遗留数据字段 | 否（见 `docs/legacy/04-data-dictionary.md`，卡片 CVV 仅存储不暴露） |
