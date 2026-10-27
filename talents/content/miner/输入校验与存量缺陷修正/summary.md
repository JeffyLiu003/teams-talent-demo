# 输入校验与存量缺陷修正 开发范式总结

**一般性场景描述**：迁移存量屏幕的字段校验时，如何把校验写进领域对象，并在同一处修正已知的存量缺陷。

**适用范围**：客户、卡片等维护功能的字段校验；存量程序中有已登记缺陷（NR-*）需要在新系统修正的场景。

## 实现步骤

### 步骤 1. 校验写成领域对象的私有方法

**实现逻辑**：每个字段一个 `requireXxx` 方法，在构造和修改时调用；方法注释写明规则编号。

**规范约束**：
- 校验失败抛 `ValidationException(field, message)`，提示语沿用存量屏幕文案。

**注意事项**：
- 先去空格再校验；数字字段保留前导零，用字符串保存。

**一般化参考代码**：

```java
/**
 * BR-CUST-07：9 位数字，首段不得为 000/666/900-999。
 */
private static String requireSsn(String rawValue) {
    String value = rawValue == null ? "" : rawValue.trim();
    if (!SSN.matcher(value).matches()) {
        throw new ValidationException("ssn", "SSN must be 9 digits.");
    }
    int firstSegment = Integer.parseInt(value.substring(0, 3));
    if (firstSegment == 0 || firstSegment == 666 || firstSegment >= 900) {
        throw new ValidationException("ssn", "SSN first 3 digits cannot be 000, 666 or 900-999.");
    }
    return value;
}
```

**参考文件**：
- `services/customer-service/src/main/java/com/cardcore/customer/domain/model/Customer.java` 行 293-368

**相关知识**：BR-CUST-07、BR-CUST-08（FICO 300–850）。

---

### 步骤 2. 只开放允许修改的字段

**实现逻辑**：维护操作用一个只含可编辑字段的对象（如 `CardMaintenance`：卡面名、状态、到期月 / 年），领域方法只改这些字段。

**规范约束**：
- 不可修改的列在实体上设 `updatable = false`；响应 DTO 不返回 CVV。

**注意事项**：
- 存量程序重写卡片记录时会把 CVV 写成空或零（NR-CARD-01），新系统从结构上杜绝。

**一般化参考代码**：

```java
@Column(name = "cvv", length = 3, nullable = false, updatable = false)
private String cvv;
```

**参考文件**：
- `services/card-service/src/main/java/com/cardcore/card/domain/model/Card.java` 行 39-40
- `services/card-service/src/main/java/com/cardcore/card/domain/model/CardMaintenance.java`
- `services/card-service/src/main/java/com/cardcore/card/application/CardApplicationService.java` 行 76

**相关知识**：BR-CARD-09、NR-CARD-01、NR-CARD-02。

## 测试要点

- 每条校验规则一个用例，断言字段名和提示语。
- 更新卡片后读取数据库，CVV 不变。

## 依据

- 业务规则目录 §2 客户、§3 卡片；`COCRDUPC.cbl:877-944,1464-1465`。
