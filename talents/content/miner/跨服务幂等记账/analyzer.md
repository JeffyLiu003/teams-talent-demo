# 跨服务幂等记账（PR #41、#47、#58）代码分析报告

## 仓库知识层次分类

三个 PR 都位于“交易落库 + 账户余额变更”跨服务写操作上，分别覆盖账单支付、日终入账和营销返现三条入口。

> card-core-java → `transaction-service`（交易上下文）→ `application`（应用服务层）→ `BillPaymentService` / `PostingService` → `infrastructure.client.AccountClient`（出站调用）→ `account-service` 的 `AccountApplicationService`（余额变更与返现去重）

核心涉及模块：

- `services/transaction-service/src/main/java/com/cardcore/transaction/application/BillPaymentService.java`：账单支付，PR #41 把“先扣余额再落交易”改为“本地 PENDING → 远程扣款 → 置 POSTED”。
- `services/transaction-service/src/main/java/com/cardcore/transaction/application/PostingService.java`：日终批量入账，PR #47 加入按 `transactionId` 的单笔幂等与“部分成功”结果。
- `services/transaction-service/src/main/java/com/cardcore/transaction/infrastructure/client/AccountClient.java`：调用账户服务的出站客户端，统一把 404、409、5xx 和连接失败转换为领域异常。
- `services/account-service/src/main/java/com/cardcore/account/application/AccountApplicationService.java`：账户服务应用层，PR #58 新增 `creditCashback()`，按 `rewardId` 去重。
- `services/account-service/src/main/resources/db/migration/V3__reward_credit.sql`：返现去重表 `reward_credit`，`reward_id` 为主键。
- 测试：`BillPaymentServiceTest`、`PostingServiceTest`、`AccountControllerTest`。

## 需求影响位置依赖分析

**核心依赖链**（账单支付 `POST /api/v1/bill-payments`）：

1. `BillPaymentController.pay()`（`BillPaymentController.java:35`）→ `BillPaymentService.pay()`（`BillPaymentService.java:50`）。
2. `pay()` 先经 `AccountClient.findAccount()`（`AccountClient.java:34`）读取欠款，金额不大于 0 时抛 `NOTHING_TO_PAY`。
3. 以 `TransactionStatus.PENDING` 构造 `TransactionRecord` 并保存（`BillPaymentService.java:64-69`）。
4. 调用 `AccountClient.payBill()`（`AccountClient.java:57`）→ 私有方法 `post()`（`AccountClient.java:65`）→ 账户服务 `POST /api/v1/accounts/{id}/payments`（`AccountController.java:60`）→ `AccountApplicationService.applyBillPayment()`（`AccountApplicationService.java:56`）→ `Account.applyBillPayment()`（`Account.java:90`）。
5. 远程成功后 `record.markPosted()` 并再次保存（`BillPaymentService.java:73-74`）；远程失败时异常穿出，`@Transactional` 回滚本地 PENDING 记录。

**日终入账**（`POST /api/v1/postings`）：

1. `PostingController.post()`（`PostingController.java:43`）→ `PostingService.post()`（`PostingService.java:69`）逐笔处理。
2. 每笔先查 `transactions.existsByTransactionId()`（`PostingService.java:77-82`），已存在则计入 `posted` 和 `duplicates`，不再记账。
3. `PostingPolicy.evaluate()`（`PostingPolicy.java:24`）判定拒付，拒付写入当日明细并继续下一笔（`PostingService.java:96-107`）。
4. 通过后依次更新类别余额、调用 `AccountClient.applyPosting()`、保存交易与当日明细（`PostingService.java:109-124`）。

**关键类型与常量**：

- `TransactionStatus`：a) 取值 `PENDING`、`POSTED`；b) 由 `TransactionRecord.markPosted()` 推进，应用服务不直接赋值。
- `RemoteServiceException`：a) 出站调用 5xx、超时、连接失败的统一载体；b) 在 `GlobalExceptionHandler.handleRemote()`（`GlobalExceptionHandler.java:31-35`）映射为 `503 DEPENDENCY_UNAVAILABLE`。
- `PostingResult`：a) 字段 `status`、`processed`、`posted`、`rejected`、`rejections`、`duplicates`；b) 有拒付时 `status` 为 `COMPLETED_WITH_REJECTS`（`PostingService.java:129`）。
- `RewardCredit`：a) 返现去重记录，字段 `rewardId`、`accountId`、`campaignId`、`amount`、`createdAt`；b) 与余额变更在同一本地事务保存。

**测试依赖**：`BillPaymentServiceTest` 用 Mockito 模拟 `AccountClient`，断言远程失败时不产生 `POSTED` 记录；`PostingServiceTest` 构造重复交易号与超限交易混合批次，断言计数与 `duplicates` 列表。

## 调用跟踪

```
BillPaymentController.pay()                 BillPaymentController.java:35
  └─ BillPaymentService.pay()               BillPaymentService.java:50
       ├─ AccountClient.findAccount()       AccountClient.java:34
       ├─ transactions.saveTransaction()    PENDING，BillPaymentService.java:69
       ├─ AccountClient.payBill()           AccountClient.java:57
       │    └─ post()                       AccountClient.java:65   404 / 409 / 5xx 转换
       │         └─ [account-service] AccountController.pay()        AccountController.java:60
       │              └─ AccountApplicationService.applyBillPayment()  AccountApplicationService.java:56
       └─ record.markPosted()               BillPaymentService.java:73

PostingController.post()                    PostingController.java:43
  └─ PostingService.post()                  PostingService.java:69
       ├─ existsByTransactionId()           PostingService.java:77   幂等返回
       ├─ PostingPolicy.evaluate()          PostingPolicy.java:24    拒付码 100–103
       ├─ AccountClient.applyPosting()      AccountClient.java:53
       └─ evaluateRewards()                 PostingService.java:137  失败只告警

[account-service] AccountController.creditCashback()   AccountController.java:75
  └─ AccountApplicationService.creditCashback()       AccountApplicationService.java:71
       ├─ rewardCredits.existsByRewardId()            已存在则直接返回账户
       ├─ Account.applyCashback()                     Account.java:118
       └─ rewardCredits.saveCredit()
```

## 其他相关概念

**编码行为与约定**：
- **本地先落状态**：跨服务写操作先在本服务保存 `PENDING`，远程成功后再推进，失败交给事务回滚，不手工删除记录。
- **出站异常归一**：客户端只抛 `NotFoundException`、`BusinessRuleException`、`RemoteServiceException` 三类，调用方不处理 HTTP 细节。
- **幂等落库**：幂等键必须有数据库唯一约束兜底，内存判断只用于提前返回。
- **附加权益隔离**：入账后的营销评估包在 `try/catch` 中，只记录告警日志。

**领域与系统知识**：
- **ADR-005 跨服务一致性**：选用“本地事务 + 同步调用 + 失败回滚 + 幂等键”，不引入分布式事务或消息队列。
- **存量入账语义**：`CBTRN02C` 逐笔处理日终交易，拒付不影响后续交易；拒付原因码 100–103 沿用存量取值。
- **欠款口径**：`ACCT-CURR-BAL` 表示欠款，账单支付全额还清当前欠款，不改本期借贷累计。

**最佳实践**：
- 每条跨服务写路径都要有“同一幂等键重复提交”和“下游 503”两类测试。
- 批量接口返回逐笔结果和计数，调用方据此对账，不只返回成功或失败。
- 新增类似写操作时，先确认下游接口是否已按幂等键去重，否则重试可能重复记账。
