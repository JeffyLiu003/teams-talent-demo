# 字段校验迁移与存量缺陷修正（PR #38、#44）代码分析报告

## 仓库知识层次分类

两个 PR 迁移存量屏幕的字段校验，并在同一处修正存量缺陷：客户资料的 SSN 首段和 FICO 范围（`COACTUPC`），以及卡片维护覆盖 CVV 的问题（`COCRDUPC`）。

> card-core-java → `customer-service` / `card-service` → `domain.model`（`Customer`、`Card`）→ 私有校验方法 `requireXxx()` → `ValidationException`

核心涉及模块：

- `services/customer-service/src/main/java/com/cardcore/customer/domain/model/Customer.java`：客户聚合，`applyDetails()` 调用一组 `requireXxx()` 私有方法完成校验。
- `services/card-service/src/main/java/com/cardcore/card/domain/model/Card.java`：卡片聚合，CVV 列 `updatable = false`，`applyMaintenance()` 只修改允许的字段。
- `services/card-service/src/main/java/com/cardcore/card/domain/model/CardMaintenance.java`：卡片维护可编辑字段的 record。
- `services/card-service/src/main/java/com/cardcore/card/application/CardApplicationService.java`：`update()` 把 `CardMaintenance` 交给领域方法。
- 测试：`CustomerTest`、`CardTest`、`CustomerControllerTest`、`CardControllerTest`。

## 需求影响位置依赖分析

**核心依赖链**（客户资料维护 `PUT /api/v1/customers/{id}`）：

1. `CustomerController` → `CustomerApplicationService.update()`（`CustomerApplicationService.java:52`）。
2. → `Customer.applyDetails()`（`Customer.java:120`），按字段依次调用 `requireName()`、`requireZipCode()`、`requireSsn()`（`Customer.java:298`）、`requireDateOfBirth()`（`Customer.java:317`）、`requireEftAccountId()`（`Customer.java:330`）、`requireFicoScore()`（`Customer.java:358`）等。
3. 任一校验失败抛 `ValidationException(field, message)`，接口层转为 400，`details` 中带字段名。

**卡片维护**（`PUT /api/v1/cards/{cardNumber}`）：

1. `CardController.update()`（`CardController.java:88`）→ `CardApplicationService.update()`（`CardApplicationService.java:78`）。
2. → `Card.applyMaintenance()`（`Card.java:75`）：只更新卡面名、状态、到期日；CVV、卡号、归属账户不在方法参数中。
3. 持久化层 `cvv` 列 `updatable = false`（`Card.java:39-40`），即使误传也不会写回。

**关键类型与常量**：

- `ValidationException(field, message)`：a) 字段级校验失败；b) 与 `BusinessRuleException` 区分，前者 400，后者 409。
- SSN 规则：a) 9 位数字；b) 首段不能是 000、666 或 900–999（存量程序漏判 900–999，PR #38 修正）。
- FICO 规则：a) 300–850；b) 存量屏幕未校验上限，PR #38 补上。
- `CardMaintenance`：a) 字段 `embossedName`、`activeStatus`、`expiryMonth`、`expiryYear`；b) 到期“日”和 CVV 不可编辑。

**测试依赖**：`CustomerTest` 对每个 `requireXxx()` 的边界值做参数化测试；`CardTest` 断言维护后 CVV 不变。

## 调用跟踪

```
CustomerController.update()
  └─ CustomerApplicationService.update()     CustomerApplicationService.java:52
       └─ Customer.applyDetails()            Customer.java:120
            ├─ requireSsn()                  Customer.java:298   首段 000 / 666 / 900-999 拒绝
            ├─ requireDateOfBirth()          Customer.java:317
            ├─ requireEftAccountId()         Customer.java:330
            └─ requireFicoScore()            Customer.java:358   300-850

CardController.update()                      CardController.java:88
  └─ CardApplicationService.update()         CardApplicationService.java:78
       └─ Card.applyMaintenance()            Card.java:75   CVV 列不可更新
```

## 其他相关概念

**编码行为与约定**：
- **校验在领域对象内**：控制器只做格式级 `@Valid`，业务含义的校验写成聚合的私有方法。
- **规则编号注释**：每个校验方法上方注明业务规则编号（如 BR-CUST-08），便于追溯。
- **只开放可改字段**：维护操作用专门的 record 表达可编辑字段集合，不复用完整实体。

**领域与系统知识**：
- **存量缺陷清单**：迁移时发现的存量缺陷记录在业务规则目录的“NR-”条目中，修正时同步更新状态。
- **CVV 安全要求**：CVV 只在发卡时生成，任何维护操作不得修改或回显。

**最佳实践**：
- 修正存量缺陷时，在 PR 描述中写明原行为、新行为和依据，方便业务确认。
- 边界值测试覆盖“刚好合法”和“刚好非法”两侧。
- 迁移一块屏幕时，把该屏幕的全部校验一次迁完，避免新旧规则并存。
