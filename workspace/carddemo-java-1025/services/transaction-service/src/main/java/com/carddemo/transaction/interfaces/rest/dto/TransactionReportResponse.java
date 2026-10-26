package com.carddemo.transaction.interfaces.rest.dto;

import com.carddemo.transaction.application.TransactionReport;
import com.carddemo.transaction.application.TransactionView;

import java.math.BigDecimal;
import java.util.List;

/**
 * 交易报表响应：items + 分页 + 三级合计（页 / 卡号 / 总计）。
 */
public record TransactionReportResponse(
        List<TransactionResponse> items,
        int page,
        int size,
        long total,
        BigDecimal pageTotal,
        List<CardTotalResponse> accountTotals,
        BigDecimal grandTotal) {

    public static TransactionReportResponse from(TransactionReport report) {
        List<TransactionView> views = report.items();
        return new TransactionReportResponse(
                views.stream().map(TransactionResponse::from).toList(),
                report.page(),
                report.size(),
                report.total(),
                report.pageTotal(),
                report.accountTotals().stream().map(CardTotalResponse::from).toList(),
                report.grandTotal());
    }
}
