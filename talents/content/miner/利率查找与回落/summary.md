# 利率查找与回落 开发范式总结

**一般性场景描述**：按“账户组 + 类型 + 类别”查参数、未命中时回落默认组的查找方式。

**适用范围**：利率、费率等按多维度配置、需要默认值的参数查找。

## 实现步骤

### 步骤 1. 先查精确组，再回落 DEFAULT

**实现逻辑**：账户有组号时按“组号 + 交易类型 + 类别”查；未命中或无组号时，按 `DEFAULT` 组查同样的类型和类别。

**规范约束**：
- 回落只发生一次；`DEFAULT` 也没有配置时利率为 0。

**注意事项**：
- 披露组只有 `A`、`DEFAULT`、`ZEROAPR` 三种（`docs/legacy/04-data-dictionary.md` §2.4），不要硬编码 `A`。

**一般化参考代码**：

```java
private BigDecimal interestRate(String groupId, String typeCode, String categoryCode) {
    Optional<DisclosureGroup> group = groupId == null || groupId.isBlank()
            ? Optional.empty()
            : disclosureGroups.find(groupId, typeCode, categoryCode);
    return group.or(() -> disclosureGroups.find(DEFAULT_GROUP_ID, typeCode, categoryCode))
            .map(DisclosureGroup::getInterestRate)
            .orElse(ZERO);
}
```

**参考文件**：
- `services/transaction-service/src/main/java/com/carddemo/transaction/application/InterestService.java` 行 122-129

**相关知识**：BR-INT-02。

---

### 步骤 2. 利率为 0 不产生利息交易

**实现逻辑**：月利息 = 类别累计额 × 年利率 ÷ 1200；利率为 0 时跳过，不写利息交易。

**规范约束**：
- 每个账户的各类别利息汇总为一笔交易（类型 01 / 类别 0005，描述 `Int. for a/c <账号>`）。

**参考文件**：
- `services/transaction-service/src/main/java/com/carddemo/transaction/application/InterestService.java` 行 90-117

**相关知识**：BR-INT-01、BR-INT-03、BR-INT-04。

## 测试要点

- 账户组未配置该类别时，使用 DEFAULT 组利率。
- `ZEROAPR` 组账户不产生利息交易。

## 依据

- `docs/legacy/03-business-rule-catalog.md` §7 利息；`CBACT04C.cbl:214-217,415-467`。
