# 利率参数查找与回落（PR #55）代码分析报告

## 仓库知识层次分类

PR #55 迁移存量计息程序 `CBACT04C` 的利率查找：先按账户的披露组查，未命中回落 DEFAULT 组；利率为 0 的类别不计息。

> carddemo-java-1025 → `transaction-service` → `application.InterestService.run()` → `interestRate()` → `DisclosureGroupRepository` → `domain.service.InterestCalculator`

核心涉及模块：

- `services/transaction-service/src/main/java/com/carddemo/transaction/application/InterestService.java`：月度计息主流程与私有方法 `interestRate()`。
- `services/transaction-service/src/main/java/com/carddemo/transaction/domain/service/InterestCalculator.java`：`monthlyInterest(balance, annualRatePercent)`。
- `services/transaction-service/src/main/java/com/carddemo/transaction/interfaces/rest/InterestController.java`：`POST /api/v1/interest-runs`。
- 测试：`InterestCalculatorTest`。

## 需求影响位置依赖分析

**核心依赖链**：

1. `InterestController.run()`（`InterestController.java:35`）→ `InterestService.run()`（`InterestService.java:67`）。
2. 遍历有类别余额的账户，经 `AccountClient.findAccount()` 取得账户组 `groupId`。
3. 对每条类别余额调用 `interestRate(groupId, typeCode, categoryCode)`（`InterestService.java:122-129`）：先查精确组，未命中再查 `DEFAULT_GROUP_ID`，仍未命中返回 0。
4. 利率为 0 时跳过（`InterestService.java:83-85`）；否则用 `InterestCalculator.monthlyInterest()` 累计账户利息。
5. 账户利息大于 0 时生成一笔利息交易，并调用 `AccountClient.accrueInterest()` 计入账户。

**关键类型与常量**：

- `DEFAULT_GROUP_ID`：a) 取值 `DEFAULT`；b) 账户组为空或精确组未配置时使用。
- `DisclosureGroup`：a) 键为“组 + 交易类型 + 类别”；b) 字段 `interestRate` 为年利率百分比。
- `INTEREST_TYPE_CODE`、`INTEREST_CATEGORY_CODE`：a) 利息交易的类型和类别；b) 沿用存量取值。

**测试依赖**：`InterestCalculatorTest` 覆盖“余额 × 年利率 ÷ 1200”的舍入；`InterestService` 的回落逻辑通过构造缺失组的数据验证。

## 调用跟踪

```
InterestController.run()                      InterestController.java:35
  └─ InterestService.run()                    InterestService.java:67
       ├─ AccountClient.findAccount()         取 groupId
       ├─ interestRate()                      InterestService.java:122
       │    ├─ disclosureGroups.find(groupId, type, category)
       │    └─ disclosureGroups.find(DEFAULT, type, category)   回落
       ├─ InterestCalculator.monthlyInterest()   InterestCalculator.java:15
       └─ AccountClient.accrueInterest()
```

## 其他相关概念

**编码行为与约定**：
- **Optional 链式回落**：用 `Optional.or()` 表达“先精确后默认”，不写嵌套 if。
- **零值短路**：利率为 0 直接跳过，不生成金额为 0 的交易。

**领域与系统知识**：
- **披露组**：存量 `DISCGRP` 文件按账户组定义各类交易的利率，`DEFAULT` 组是兜底配置。
- **计息口径**：按类别余额逐条计算后汇总到账户，再生成一笔利息交易。

**最佳实践**：
- 参数查找类逻辑集中在一个私有方法，便于单独测试回落顺序。
- 测试覆盖“精确命中”“回落命中”“都未命中”三种情况。
