# 过期授权清理与额度释放（PR #50）代码分析报告

## 仓库知识层次分类

PR #50 修正存量清理批处理的额度泄漏：删除过期授权明细后，按剩余明细重算每个账户的授权汇总。

> card-core-java → `authorization-service` → `application.AuthorizationService.purge()` → `domain.model.AuthorizationSummary.recalculateFromDetails()`

核心涉及模块：

- `services/authorization-service/src/main/java/com/cardcore/authorization/application/AuthorizationService.java`：`purge()` 找出受影响账户、删除过期明细、逐账户重算汇总。
- `services/authorization-service/src/main/java/com/cardcore/authorization/domain/model/AuthorizationSummary.java`：授权汇总聚合，`recalculateFromDetails()` 与 `isEmpty()`，带 `@Version`。
- `services/authorization-service/src/main/java/com/cardcore/authorization/interfaces/rest/AuthorizationController.java`：`POST /api/v1/authorization-purges`。
- 测试：`AuthorizationServiceTest`。

## 需求影响位置依赖分析

**核心依赖链**：

1. `AuthorizationController.purge()`（`AuthorizationController.java:85`）→ `AuthorizationService.purge()`（`AuthorizationService.java:175`）。
2. 计算截止时间 `now − expiryDays`，查出过期明细并累计已批准金额作为 `released`。
3. 收集过期明细涉及的账户（`AuthorizationService.java:187-192`），再批量删除过期明细（`authorizations.deleteExpired()`）。
4. 对每个受影响账户读取剩余明细，重算批准笔数、批准金额、拒绝笔数、拒绝金额，调用 `AuthorizationSummary.recalculateFromDetails()`（`AuthorizationSummary.java:88`）。
5. 汇总为空（批准与拒绝笔数均为 0）时删除汇总，否则保存（`AuthorizationService.java:215-220`）。

**关键类型与常量**：

- `PurgeResult`：a) 字段 `summariesRead`、`summariesDeleted`、`detailsRead`、`detailsDeleted`、`released`；b) 作为批处理运行结果返回。
- `AuthorizationSummary.creditBalance`：a) 已占用的授权额度；b) 重算后等于剩余已批准金额之和。
- `DEFAULT_EXPIRY_DAYS`：a) 未传参数时的默认保留天数；b) 与存量 JCL 参数一致。

**测试依赖**：`AuthorizationServiceTest` 构造同一账户既有过期又有未过期明细的数据，断言汇总只保留未过期部分。

## 调用跟踪

```
AuthorizationController.purge()                    AuthorizationController.java:85
  └─ AuthorizationService.purge()                  AuthorizationService.java:175
       ├─ authorizations.findExpired(cutoff)
       ├─ affectedAccounts 收集                    AuthorizationService.java:187-192
       ├─ authorizations.deleteExpired(cutoff)
       └─ for accountId in affectedAccounts
            ├─ authorizations.findAllByAccountId()
            ├─ AuthorizationSummary.recalculateFromDetails()   AuthorizationSummary.java:88
            └─ isEmpty() ? deleteSummary() : saveSummary()     AuthorizationSummary.java:98
```

## 其他相关概念

**编码行为与约定**：
- **重算而不是增减**：汇总值由明细重新计算，不在删除时做减法，避免历史误差累积。
- **只处理受影响账户**：先收集账户集合，再逐个重算，不全表扫描汇总。

**领域与系统知识**：
- **存量缺陷 NR-AUTH-01/02**：存量清理程序只删明细不改汇总，导致可用额度长期偏低。
- **可用额度**：`AuthorizationPolicy.availableCredit()` 用信用额度减授权汇总占用和账户欠款计算。

**最佳实践**：
- 清理类批处理返回读取数、删除数和释放金额，便于运维核对。
- 测试同时覆盖“账户全部过期”和“部分过期”两种情况。
