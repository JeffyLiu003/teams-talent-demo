# 交易明细分页导出 开发范式总结

**一般性场景描述**：存量批量报表迁移为查询接口时，如何保留分页与三级合计口径，并校验引用完整性。

**适用范围**：存量系统中按日期范围生成、带分页小计和总计的批量报表（如交易明细报表 `CBTRN03C`），迁移为查询接口或导出功能。

## 实现步骤

### 步骤 1. 日期范围闭区间查询

**实现逻辑**：接口接收 `startDate`、`endDate`（ISO 日期），查询时取 `[start 00:00, end 23:59:59.999]`。

**规范约束**：
- 月报、年报等报表类型由前端换算成日期范围后传入，后端只认日期范围。

**注意事项**：
- 按处理日期过滤，不按原始交易日期。

**一般化参考代码**：

```java
LocalDateTime from = startDate.atStartOfDay();
LocalDateTime to = endDate.atTime(LocalTime.MAX);
```

**参考文件**：
- `services/transaction-service/src/main/java/com/cardcore/transaction/application/TransactionReportService.java` 行 44-51
- `services/transaction-service/src/main/java/com/cardcore/transaction/interfaces/rest/ReportController.java` 行 23-31

**相关知识**：BR-RPT-01、BR-RPT-02（业务规则目录 §10）。

---

### 步骤 2. 先校验引用，再分页

**实现逻辑**：查出全部行后，先校验卡号、交易类型、类别都存在，再切出当前页。

**规范约束**：
- 引用缺失时整个报表失败，返回 409 `REPORT_REFERENCE_ERROR`，不输出部分结果。

**注意事项**：
- 分页参数默认 `page=0`、`size=50`；`size ≤ 0` 返回空页。

**一般化参考代码**：

```java
private static List<TransactionRecord> slice(List<TransactionRecord> rows, int page, int size) {
    if (size <= 0) {
        return List.of();
    }
    int from = Math.min(page * size, rows.size());
    int to = Math.min(from + size, rows.size());
    return rows.subList(from, to);
}
```

**参考文件**：
- `services/transaction-service/src/main/java/com/cardcore/transaction/application/TransactionReportService.java` 行 53-55、112-119

**相关知识**：BR-RPT-04。

---

### 步骤 3. 保留三级合计口径

**实现逻辑**：响应同时返回本页合计、按卡号合计和总计。

**规范约束**：
- 合计基于全部行计算，不只基于本页；金额为 JSON 数值，格式化由前端完成。

**注意事项**：
- 存量报表每 20 行分页，新系统不再做纸质分页，但合计口径保持一致。

**参考文件**：
- `services/transaction-service/src/main/java/com/cardcore/transaction/application/TransactionReportService.java` 行 56-67

**相关知识**：BR-RPT-03、BR-RPT-05。

## 测试要点

- 跨页查询时，按卡号合计与总计不随页码变化。
- 存在已删除类别的交易时返回 409。

## 依据

- 业务规则目录 §10 报表；`CBTRN03C.cbl:173-203,282-322,484-512`。
