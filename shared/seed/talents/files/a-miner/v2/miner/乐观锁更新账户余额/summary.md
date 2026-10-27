# 乐观锁更新账户余额 开发范式总结

**一般性场景描述**：修改账户、卡片等聚合时如何检测并发修改，并把余额变更写成领域行为。

**适用范围**：账户资料维护、记账、还款、计息、返现，以及卡片维护等对单个聚合的更新。存量系统用 `READ UPDATE` 加锁和快照比对实现，新系统统一改为乐观锁。

## 实现步骤

### 步骤 1. 聚合表与实体加版本号

**实现逻辑**：每个聚合表带 `version BIGINT NOT NULL DEFAULT 0`，实体字段加 `@Version`。

**规范约束**：
- 版本号字段只由 JPA 维护，业务代码不手动修改；新建实体时初始化为 0。

**注意事项**：
- Flyway 建表脚本与实体同时修改，H2 与 PostgreSQL 行为一致。

**一般化参考代码**：

```java
@Version
@Column(name = "version", nullable = false)
private long version;
```

**参考文件**：
- `services/account-service/src/main/java/com/carddemo/account/domain/model/Account.java` 行 60-62
- `services/card-service/src/main/java/com/carddemo/card/domain/model/Card.java` 行 51-53
- `services/account-service/src/main/resources/db/migration/V1__account_schema.sql` 行 14

---

### 步骤 2. 余额变更写成领域方法

**实现逻辑**：记账、还款、计息、返现各自是 `Account` 上的方法，方法内完成业务断言与字段变更；应用服务只做“读取 → 调领域方法 → 保存”。

**规范约束**：
- 断言失败抛 `BusinessRuleException(code, message)`；不在应用服务里直接 set 余额。

**注意事项**：
- 记账按金额正负分流本期贷 / 借（正数进 CREDIT，负数进 DEBIT）；账单支付只减余额，不改本期累计。

**一般化参考代码**：

```java
public void applyBillPayment(BigDecimal amount) {
    if (amount.signum() <= 0) {
        throw new BusinessRuleException("INVALID_PAYMENT_AMOUNT", "Payment amount must be greater than zero.");
    }
    if (currentBalance.signum() <= 0) {
        throw new BusinessRuleException("NOTHING_TO_PAY", "You have nothing to pay...");
    }
    if (amount.compareTo(currentBalance) > 0) {
        throw new BusinessRuleException("PAYMENT_EXCEEDS_BALANCE", "Payment amount must not exceed the current balance.");
    }
    currentBalance = currentBalance.subtract(amount);
}
```

**参考文件**：
- `services/account-service/src/main/java/com/carddemo/account/domain/model/Account.java` 行 77-124
- `services/account-service/src/main/java/com/carddemo/account/application/AccountApplicationService.java` 行 44-66

**相关知识**：BR-ACCT-09、BR-ACCT-10、BR-ACCT-11、NR-ACCT-01（`docs/legacy/03-business-rule-catalog.md` §4）；`ACCT-CURR-BAL` 是欠款而非可用余额（`docs/legacy/05-ubiquitous-language.md` §2）。

---

### 步骤 3. 冲突统一映射为 409

**实现逻辑**：全局异常处理捕获 `OptimisticLockingFailureException`，返回 `409 CONCURRENT_UPDATE`，提示语沿用存量文案。

**规范约束**：
- 每个服务的 `GlobalExceptionHandler` 都要有这一项，错误体为统一格式 `{code, message, details}`。

**注意事项**：
- 余额和额度不能自动合并，调用方收到 409 后重新读取再重试。

**一般化参考代码**：

```java
@ExceptionHandler(OptimisticLockingFailureException.class)
public ResponseEntity<ApiError> handleOptimisticLock(OptimisticLockingFailureException ex) {
    return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(ApiError.of("CONCURRENT_UPDATE", "Record changed by some one else. Please review"));
}
```

**参考文件**：
- `services/account-service/src/main/java/com/carddemo/account/interfaces/rest/GlobalExceptionHandler.java` 行 38-43

---

### 步骤 4. 响应返回版本号

**实现逻辑**：资源响应 DTO 带 `version`，前端更新时回传；冲突时提示用户刷新。

**规范约束**：
- 卡片响应不返回 CVV；卡片维护只允许修改卡面姓名、状态、到期月 / 年，CVV 列设为 `updatable = false`。

**参考文件**：
- `services/card-service/src/main/java/com/carddemo/card/interfaces/rest/dto/CardResponse.java` 行 10-27
- `services/card-service/src/main/java/com/carddemo/card/domain/model/Card.java` 行 39-40、75

**相关知识**：NR-CARD-01、NR-CARD-02。

## 测试要点

- 两个请求基于同一版本更新：第二个返回 409 `CONCURRENT_UPDATE`。
- 领域方法单测覆盖每个业务断言的错误码。

## 依据

- carddemo-java-1025 / docs/design/adr/ADR-006-optimistic-locking.md
- carddemo-java-1025 / docs/design/07-java-conventions.md §3、§6
- 业务规则（`docs/legacy/03-business-rule-catalog.md`）：BR-ACCT-06、BR-CARD-10
