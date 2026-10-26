package com.carddemo.transaction.application;

import java.math.BigDecimal;
import java.util.List;

/**
 * 交易报表（CBTRN03C）：当前页 + 三级合计（页 / 卡号 / 总计）。
 */
public record TransactionReport(
        List<TransactionView> items,
        int page,
        int size,
        long total,
        BigDecimal pageTotal,
        List<CardTotal> accountTotals,
        BigDecimal grandTotal) {
}
