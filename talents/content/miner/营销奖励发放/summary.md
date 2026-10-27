# 营销奖励发放 开发范式总结

**一般性场景描述**：在核心账务流程之后追加“附加权益”（返现、积分）时，如何做资格判定、预算控制与入账，且不影响核心流程。

**适用范围**：消费入账后的返现、积分、首刷礼等营销奖励；以及其他“核心流程成功后附加执行、失败可补偿”的能力。

## 实现步骤

### 步骤 1. 核心流程提交后再触发，失败只告警

**实现逻辑**：入账本地事务提交后，同步调用 `POST /api/v1/reward-evaluations`（2 秒超时）；评估失败只记录告警，不回滚入账。

**规范约束**：
- 通过配置开关（`marketing.enabled`）控制是否启用；不得在核心事务里等待营销结果。

**注意事项**：
- 消费是资金事实，营销是附加权益——两者的失败语义不同。

**参考文件**：
- `services/transaction-service/src/main/java/com/cardcore/transaction/application/PostingService.java` 行 126、134-150

**依据**：ADR-009 营销集成方式

---

### 步骤 2. 按固定顺序做资格判定

**实现逻辑**：遍历当前有效的活动，逐项判定，命中第一个不满足的条件即返回原因码。

**规范约束**：
- 判定顺序固定为 MK-ELI-01～09：活动有效期 → 账户状态 `Y` → 目标账户组 → 交易类别 → 最低金额 → 是否已报名 → 每卡次数上限 → 首刷限制 → 预算剩余。

**注意事项**：
- 判定逻辑放在领域服务 `EligibilityPolicy`，便于单测；原因码同时给活动中心展示文案。

**一般化参考代码**：

```java
EligibilityPolicy.Evaluation evaluation = EligibilityPolicy.evaluateTransaction(
        campaign, account, command.amount(), command.categoryCode(), enrolled, rewardsOnCard, now);
if (!evaluation.eligible()) {
    skipped.add(new Skipped(campaign.getCampaignId(), campaign.getName(), evaluation.reason()));
    continue;
}
```

**参考文件**：
- `services/marketing-service/src/main/java/com/cardcore/marketing/application/RewardEvaluationService.java` 行 64-81

---

### 步骤 3. 同一活动同一交易只评估一次

**实现逻辑**：评估前检查 `(campaign_id, transaction_id)` 是否已有奖励记录，有则跳过（`ALREADY_EVALUATED`）。

**规范约束**：
- 数据库加唯一约束 `uk_reward_campaign_txn UNIQUE (campaign_id, transaction_id)`。

**参考文件**：
- `RewardEvaluationService.java` 行 65-69
- `services/marketing-service/src/main/resources/db/migration/V1__marketing_schema.sql` 行 55

---

### 步骤 4. 先扣预算，再发放

**实现逻辑**：计算奖励后调用 `campaign.consumeCashback(amount)` 扣减预算；预算不足时跳过并记 `BUDGET_EXHAUSTED`。

**规范约束**：
- 计价规则：固定返现优先，否则 `round(交易额 × 返现率, 2)`，再按单笔上限封顶；积分为 `floor(交易额 × 倍数)`；奖励必须 > 0。

---

### 步骤 5. 返现入账失败保留 PENDING，可人工重试

**实现逻辑**：返现调用账户服务 `cashback-credits`（幂等键 `rewardId`）；成功置 `GRANTED`，远程失败置 `PENDING` 并记录原因；提供 `POST /api/v1/rewards/{id}/fulfill` 人工重试。

**规范约束**：
- 应用服务使用 `@Transactional(noRollbackFor = RemoteServiceException.class)`，远程失败时仍保存奖励记录与预算扣减。

**一般化参考代码**：

```java
if (grant.isCashback()) {
    try {
        accountClient.creditCashback(accountId, grant.getRewardId(), campaignId, grant.getRewardAmount());
        grant.markGranted(now);
    } catch (RemoteServiceException ex) {
        grant.markPending("Cashback credit pending: " + ex.getMessage());
    }
}
```

**参考文件**：
- `RewardEvaluationService.java` 行 31、92-108、113-136

**相关范式**：跨服务幂等记账（步骤 4：下游按幂等键去重）

## 测试要点

- 同一交易重复评估：只产生一条奖励。
- 账户服务不可用：奖励为 `PENDING`，入账结果不受影响；恢复后人工重试变为 `GRANTED`。
- 预算刚好耗尽：后续交易跳过并返回 `BUDGET_EXHAUSTED`。

## 依据

- 信用卡核心业务文档 / design/08-marketing-capability.md §2–§3
- 信用卡核心业务文档 / design/adr/ADR-009-marketing-integration.md
