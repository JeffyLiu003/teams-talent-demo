# 营销奖励评估与返现发放（PR #61、#63、#66）代码分析报告

## 仓库知识层次分类

三个 PR 引入营销服务的奖励评估：入账成功后触发评估，按固定顺序判定资格，扣减活动预算后发放返现，返现入账失败时保留 PENDING 供人工重试。

> card-core-java → `transaction-service.PostingService.evaluateRewards()` → `MarketingClient` → `marketing-service` → `application.RewardEvaluationService.evaluate()` → `domain.service.EligibilityPolicy` → `infrastructure.client.AccountClient.creditCashback()` → `account-service`

核心涉及模块：

- `services/transaction-service/src/main/java/com/cardcore/transaction/application/PostingService.java`：入账后调用 `evaluateRewards()`，失败只告警（PR #63）。
- `services/transaction-service/src/main/java/com/cardcore/transaction/infrastructure/client/MarketingClient.java`：调用 `POST /api/v1/reward-evaluations`。
- `services/marketing-service/src/main/java/com/cardcore/marketing/application/RewardEvaluationService.java`：评估主流程 `evaluate()` 与人工重试 `fulfill()`（PR #61、#66）。
- `services/marketing-service/src/main/java/com/cardcore/marketing/domain/service/EligibilityPolicy.java`：资格判定，`evaluateTransaction()`。
- `services/marketing-service/src/main/java/com/cardcore/marketing/domain/model/Campaign.java`：活动聚合，`hasBudgetFor()`、`consumeCashback()`。
- `services/marketing-service/src/main/java/com/cardcore/marketing/domain/model/RewardGrant.java`：奖励记录，`markGranted()`、`markPending()`。
- `services/marketing-service/src/main/resources/db/migration/V1__marketing_schema.sql`：`uk_reward_campaign_txn` 唯一约束。
- 测试：`RewardEvaluationServiceTest`、`EligibilityPolicyTest`、`CampaignTest`、`MarketingApiTest`。

## 需求影响位置依赖分析

**核心依赖链**：

1. `PostingService.post()` 每笔入账成功后调用 `evaluateRewards()`（`PostingService.java:137-150`），开关关闭时直接返回，异常只记 `warn` 日志。
2. `MarketingClient.evaluateRewards()`（`MarketingClient.java:25`）→ `RewardController.evaluate()`（`RewardController.java:45`）→ `RewardEvaluationService.evaluate()`（`RewardEvaluationService.java:52`）。
3. 对每个进行中的活动：先查是否已评估过同一交易（`RewardEvaluationService.java:64-68`），再查报名和该卡已获奖次数，调用 `EligibilityPolicy.evaluateTransaction()`（`EligibilityPolicy.java:68`）。
4. 资格通过后 `campaign.consumeCashback()`（`Campaign.java:195`）扣预算，预算不足记为 `BUDGET_EXHAUSTED` 跳过。
5. 返现类奖励调用 `AccountClient.creditCashback()`（`AccountClient.java:48`）→ 账户服务按 `rewardId` 幂等入账；远程失败时 `grant.markPending()`（`RewardGrant.java:101`），奖励与活动一并保存。
6. 人工重试 `POST /api/v1/rewards/{id}/fulfill`（`RewardController.java:63`）→ `RewardEvaluationService.fulfill()`（`RewardEvaluationService.java:113`），用同一 `rewardId` 再次入账。

**关键类型与常量**：

- `EvaluationOutcome`：a) `grants` 与 `skipped` 两个列表；b) `skipped` 带原因，如 `ALREADY_EVALUATED`、`BUDGET_EXHAUSTED`、`ACCOUNT_NOT_FOUND`。
- `RewardStatus`：a) `GRANTED`、`PENDING`、`FAILED`；b) PENDING 可人工重试。
- `uk_reward_campaign_txn`：a) `UNIQUE (campaign_id, transaction_id)`（`V1__marketing_schema.sql:55`）；b) 保证同一活动同一交易只发一次。

**测试依赖**：`RewardEvaluationServiceTest` 模拟账户服务失败，断言奖励为 PENDING 且活动预算已扣减；`EligibilityPolicyTest` 按判定顺序逐项覆盖跳过原因。

## 调用跟踪

```
PostingService.post()                               PostingService.java:69
  └─ evaluateRewards()                              PostingService.java:137   失败只告警
       └─ MarketingClient.evaluateRewards()         MarketingClient.java:25
            └─ [marketing-service] RewardController.evaluate()     RewardController.java:45
                 └─ RewardEvaluationService.evaluate()             RewardEvaluationService.java:52
                      ├─ rewards.existsByCampaignAndTransaction()  ALREADY_EVALUATED
                      ├─ EligibilityPolicy.evaluateTransaction()   EligibilityPolicy.java:68
                      ├─ Campaign.consumeCashback()                Campaign.java:195
                      ├─ AccountClient.creditCashback()            AccountClient.java:48
                      │    └─ [account-service] AccountApplicationService.creditCashback()
                      └─ RewardGrant.markGranted() / markPending()

RewardController.fulfill()                          RewardController.java:63
  └─ RewardEvaluationService.fulfill()              RewardEvaluationService.java:113
```

## 其他相关概念

**编码行为与约定**：
- **核心与附加分离**：入账是资金事实，营销是附加权益，营销失败不回滚入账。
- **判定顺序固定**：活动状态、账户组、交易类别、报名、单卡次数、预算，按此顺序判定并返回第一个不满足的原因。
- **先扣预算再发放**：预算扣减与奖励记录在同一事务保存，发放失败不退回预算，PENDING 重试时不再扣减。

**领域与系统知识**：
- **ADR-009 营销集成**：营销服务通过同步接口接入入账流程，提供开关 `marketing.enabled`。
- **返现入账幂等**：账户服务的 `reward_credit` 表以 `rewardId` 去重，见范式“跨服务幂等记账”。

**最佳实践**：
- 新增附加权益类型时，复用 `EligibilityPolicy` 的判定顺序，只扩展计算部分。
- 测试覆盖“已评估跳过”“预算不足”“下游失败转 PENDING”“人工重试成功”四种路径。
