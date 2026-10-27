# 账户与卡片并发更新（PR #23、#29、#52）代码分析报告

## 仓库知识层次分类

三个 PR 把存量系统“读锁 + 快照比对”的并发控制改为 JPA 乐观锁，并把余额变更收敛为 `Account` 上的领域方法。

> card-core-java → `account-service` / `card-service`（账户、卡片上下文）→ `domain.model`（聚合根 `Account`、`Card`）→ `@Version` 字段 → `interfaces.rest.GlobalExceptionHandler`（409 映射）

核心涉及模块：

- `services/account-service/src/main/java/com/cardcore/account/domain/model/Account.java`：账户聚合，`@Version` 字段与 `applyPosting()`、`applyBillPayment()`、`accrueInterest()`、`applyCashback()` 四个领域方法。
- `services/account-service/src/main/java/com/cardcore/account/application/AccountApplicationService.java`：应用服务，只做“读取 → 调领域方法 → 保存”。
- `services/card-service/src/main/java/com/cardcore/card/domain/model/Card.java`：卡片聚合，`@Version` 与 `applyMaintenance()`，CVV 列不可更新。
- `services/account-service/src/main/java/com/cardcore/account/interfaces/rest/GlobalExceptionHandler.java`：捕获 `OptimisticLockingFailureException`，返回 `409 CONCURRENT_UPDATE`。
- `services/account-service/src/main/resources/db/migration/V1__account_schema.sql`：`version BIGINT NOT NULL DEFAULT 0`。
- 测试：`AccountTest`、`AccountControllerTest`、`CardTest`、`CardControllerTest`。

## 需求影响位置依赖分析

**核心依赖链**（账户资料维护 `PUT /api/v1/accounts/{id}`）：

1. `AccountController.update()`（`AccountController.java:48`）→ `AccountApplicationService.update()`（`AccountApplicationService.java:44`）。
2. `update()` 读取聚合后调用 `Account.applyDetails()`（`Account.java:143`），字段校验失败抛 `BusinessRuleException`。
3. `accounts.saveAccount()` 提交时 JPA 比对 `version`，版本已变化时抛 `OptimisticLockingFailureException`。
4. 异常穿出到 `GlobalExceptionHandler.handleOptimisticLock()`，返回 409 与存量提示文案。

**余额变更**（由交易服务远程调用）：

1. `POST /{id}/postings`（`AccountController.java:54`）→ `applyPosting()`（`AccountApplicationService.java:50`）→ `Account.applyPosting()`（`Account.java:77`），按金额正负分别累计本期贷、本期借。
2. `POST /{id}/payments`（`AccountController.java:60`）→ `Account.applyBillPayment()`（`Account.java:90`），三条断言：金额大于 0、欠款大于 0、金额不超过欠款。
3. `POST /{id}/interest-accruals`（`AccountController.java:66`）→ `Account.accrueInterest()`（`Account.java:107`）。

**关键类型与常量**：

- `Account.version`：a) `@Version` 注解的 `long` 字段（`Account.java:60-62`）；b) 只由 JPA 维护，响应 DTO 原样返回。
- `BusinessRuleException(code, message)`：a) 领域断言失败的唯一载体；b) 错误码如 `INVALID_PAYMENT_AMOUNT`、`NOTHING_TO_PAY`、`PAYMENT_EXCEEDS_BALANCE`。
- `CardMaintenance`：a) 卡片维护可编辑字段集合（卡面名、状态、到期月、到期年）；b) 由 `CardApplicationService.update()`（`CardApplicationService.java:78`）传给 `Card.applyMaintenance()`（`Card.java:75`）。
- `Card.cvv`：a) `@Column(updatable = false)`（`Card.java:39-40`）；b) `CardResponse` 不返回 CVV。

**测试依赖**：`AccountTest` 对每个领域方法的断言分别校验错误码；`AccountControllerTest` 用两次基于同一版本的更新请求验证第二次返回 409。

## 调用跟踪

```
AccountController.update()                    AccountController.java:48
  └─ AccountApplicationService.update()       AccountApplicationService.java:44
       ├─ Account.applyDetails()              Account.java:143
       └─ accounts.saveAccount()              version 比对
            └─ OptimisticLockingFailureException
                 └─ GlobalExceptionHandler.handleOptimisticLock()   409 CONCURRENT_UPDATE

AccountController.pay()                       AccountController.java:60
  └─ AccountApplicationService.applyBillPayment()   AccountApplicationService.java:56
       └─ Account.applyBillPayment()          Account.java:90

CardController.update()                       CardController.java:88
  └─ CardApplicationService.update()          CardApplicationService.java:78
       └─ Card.applyMaintenance()             Card.java:75   CVV 不变
```

## 其他相关概念

**编码行为与约定**：
- **领域方法收口**：余额字段没有公开 setter，所有变更经 `Account` 的方法完成，断言写在方法内。
- **版本号透传**：响应带 `version`，前端更新时回传，冲突提示用户刷新后重试。
- **统一错误体**：`{code, message, details}`，409 文案沿用存量 `Record changed by some one else. Please review`。

**领域与系统知识**：
- **ADR-006 乐观锁**：账户、卡片、客户、授权汇总等聚合统一使用 `@Version`，不使用悲观锁。
- **存量并发控制**：`COACTUPC`、`COCRDUPC` 用 `READ UPDATE` 加锁并比对快照，检测到变化时提示同一句文案。
- **余额与额度不可自动合并**：冲突后必须重新读取，不能在服务端自动重放。

**最佳实践**：
- 新增聚合时同时修改实体、Flyway 脚本和响应 DTO，三处一起加版本号。
- 每个服务的 `GlobalExceptionHandler` 都要处理 `OptimisticLockingFailureException`，否则会落到 500。
- 领域方法的单测按错误码逐条覆盖，控制器测试只验证 HTTP 映射。
