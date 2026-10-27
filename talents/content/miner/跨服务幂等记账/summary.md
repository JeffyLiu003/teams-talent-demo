# 跨服务幂等记账 开发范式总结

**一般性场景描述**：一次业务操作需要同时写本服务的数据和另一个服务的账户余额时，如何保证可重试且不重复记账。

**适用范围**：账单支付、日终入账、营销返现等“交易落库 + 账户余额变更”分属两个服务、两个数据库的写操作。不适用于只读组合查询（见 ADR-004 的组合查询）。

## 实现步骤

### 步骤 1. 为每笔操作确定幂等键

**实现逻辑**：入账以 `transactionId` 为幂等键，返现以 `rewardId` 为幂等键；调用方生成或透传，重复提交直接返回既有结果。

**规范约束**：
- 幂等键必须是业务唯一号，并落到数据库唯一约束（主键或 `UNIQUE`），不能只靠内存判断。

**注意事项**：
- 重复请求计入“已处理”，不计入失败；批量入账要把重复的交易号单独列出。

**一般化参考代码**：

```java
String id = trimToNull(command.businessId());
if (id != null && repository.existsById(id)) {
    processed++;
    duplicates.add(id);   // 幂等返回，不重复记账
    continue;
}
```

**参考文件**：
- `services/transaction-service/src/main/java/com/cardcore/transaction/application/PostingService.java` 行 76-86

**相关知识**：NR-POST-01 单笔入账幂等（业务规则目录 §5）。

---

### 步骤 2. 本地先落“处理中”状态

**实现逻辑**：在本服务事务内先保存交易，状态为 `PENDING`，再调用下游服务。

**规范约束**：
- 状态机至少包含 `PENDING`、`POSTED`；状态变更通过领域方法（如 `record.markPosted()`），不直接 set。

**注意事项**：
- `PENDING` 记录是对账依据，不要在失败时物理删除，交给事务回滚。

**一般化参考代码**：

```java
TransactionRecord record = new TransactionRecord(idGenerator.next(), accountId, cardNumber,
        typeCode, categoryCode, source, description, amount, ..., TransactionStatus.PENDING);
transactions.saveTransaction(record);
```

**参考文件**：
- `services/transaction-service/src/main/java/com/cardcore/transaction/application/BillPaymentService.java` 行 64-70

---

### 步骤 3. 同步调用下游执行余额变更

**实现逻辑**：通过出站客户端调用账户服务（如 `POST /api/v1/accounts/{id}/payments`），成功后把本地记录置为 `POSTED`。

**规范约束**：
- 客户端把 5xx、超时、连接失败统一转换为 `RemoteServiceException`，全局异常处理映射为 `503 DEPENDENCY_UNAVAILABLE`；不得吞异常。

**注意事项**：
- 下游失败时本地事务整体回滚，客户端可用同一请求重试；因为有幂等键，重试不会重复扣款。

**一般化参考代码**：

```java
AccountSnapshot updated = accountClient.payBill(accountId, amount);
record.markPosted();
transactions.saveTransaction(record);
```

**参考文件**：
- `services/transaction-service/src/main/java/com/cardcore/transaction/application/BillPaymentService.java` 行 72-77
- `services/transaction-service/src/main/java/com/cardcore/transaction/infrastructure/client/AccountClient.java` 行 40-50

---

### 步骤 4. 下游按幂等键去重

**实现逻辑**：账户服务收到返现入账请求时先查 `reward_credit` 是否已有该 `rewardId`，有则直接返回当前账户。

**规范约束**：
- 去重记录与余额变更在同一本地事务内保存。

**注意事项**：
- 去重表只记录必要字段（键、账户、金额、时间），不复制业务明细。

**一般化参考代码**：

```java
public Account creditCashback(String accountId, String rewardId, String campaignId, BigDecimal amount) {
    if (rewardCredits.existsByRewardId(rewardId)) {
        return getById(accountId);
    }
    Account account = getById(accountId);
    account.applyCashback(amount);
    Account saved = accounts.saveAccount(account);
    rewardCredits.saveCredit(new RewardCredit(rewardId, accountId, campaignId, amount, LocalDateTime.now()));
    return saved;
}
```

**参考文件**：
- `services/account-service/src/main/java/com/cardcore/account/application/AccountApplicationService.java` 行 71-81
- `services/account-service/src/main/resources/db/migration/V3__reward_credit.sql`

---

### 步骤 5. 批量场景单笔失败不中断整批

**实现逻辑**：批量入账逐笔处理，单笔校验失败记为 `REJECTED` 并写明原因码，继续下一笔；结束时返回 `processed / posted / rejected` 计数，有拒付时状态为 `COMPLETED_WITH_REJECTS`。

**规范约束**：
- 拒付原因码沿用存量取值 100–103。

**注意事项**：
- 附加权益（如营销奖励评估）失败只告警，不影响入账结果。

**参考文件**：
- `services/transaction-service/src/main/java/com/cardcore/transaction/application/PostingService.java` 行 96-132

## 测试要点

- 同一幂等键提交两次：余额只变化一次，第二次返回相同结果。
- 下游返回 503：本地无 `POSTED` 记录，响应 503，可重试。
- 批量中混入一笔超限交易：其余交易正常入账，结果为 `COMPLETED_WITH_REJECTS`。

## 依据

- 信用卡核心业务文档 / design/adr/ADR-005-cross-service-consistency.md（方案 A：本地事务 + 同步调用 + 失败回滚 + 幂等键）
- 业务规则：BR-BILL-05、BR-POST-06、BR-POST-08、NR-POST-01
