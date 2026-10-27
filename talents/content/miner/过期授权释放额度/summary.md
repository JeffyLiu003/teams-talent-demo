# 过期授权释放额度 开发范式总结

**一般性场景描述**：清理类批处理如何按账户重算汇总，避免存量系统的额度泄漏。

**适用范围**：定期清理过期授权、过期预占等会影响额度或余额汇总的批处理。

## 实现步骤

### 步骤 1. 先找出受影响的账户

**实现逻辑**：按截止时间查出过期明细，记录涉及的账户，再删除明细。

**规范约束**：
- 过期天数默认 5 天，可由请求覆盖；截止时间基于注入的 `Clock`。

**注意事项**：
- 释放金额只统计已批准的明细，用于返回结果，不直接用来扣减某个账户。

**参考文件**：
- `services/authorization-service/src/main/java/com/carddemo/authorization/application/AuthorizationService.java` 行 175-193

**相关知识**：BR-AUTH-13。

---

### 步骤 2. 按剩余明细重算每个账户的汇总

**实现逻辑**：对每个受影响账户，用剩余明细重新统计批准 / 拒绝笔数和金额，并重算占用额度。

**规范约束**：
- 不在汇总上做增减，统一“由明细重算”；批准与拒绝笔数都为 0 时删除汇总。

**注意事项**：
- 存量程序清理时不回退信用余额（NR-AUTH-01），汇总删除条件也有误（NR-AUTH-02），新系统一并修正。

**一般化参考代码**：

```java
for (AuthorizationCase detail : authorizations.findAllByAccountId(accountId)) {
    if (detail.isApproved()) {
        approvedCount += 1;
        approvedAmount = approvedAmount.add(detail.getApprovedAmount());
    } else {
        declinedCount += 1;
        declinedAmount = declinedAmount.add(detail.getTransactionAmount());
    }
}
summary.recalculateFromDetails(approvedCount, approvedAmount, declinedCount, declinedAmount, approvedAmount);
```

**参考文件**：
- `services/authorization-service/src/main/java/com/carddemo/authorization/application/AuthorizationService.java` 行 195-222
- `services/authorization-service/src/main/java/com/carddemo/authorization/domain/model/AuthorizationSummary.java` 行 88-99

**相关知识**：NR-AUTH-01、NR-AUTH-02、NR-AUTH-03。

## 测试要点

- 两个账户各有过期和未过期授权：清理后各自的占用额度只回退自己的批准金额。
- 测试使用固定时间的 `Clock`。

## 依据

- `docs/legacy/03-business-rule-catalog.md` §9 授权；`CBPAUP0C.cbl:156,196-209,280-346`。
