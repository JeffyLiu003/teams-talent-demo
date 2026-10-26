package com.carddemo.transaction.domain.repository;

import java.time.LocalDateTime;

/**
 * 交易查询条件。全部字段可选，空值表示不过滤。
 * {@code processedFrom}/{@code processedTo} 用于报表的闭区间过滤（BR-RPT-02）。
 */
public record TransactionFilter(
        String idPrefix,
        String cardNumber,
        String accountId,
        LocalDateTime processedFrom,
        LocalDateTime processedTo) {

    public static TransactionFilter all() {
        return new TransactionFilter(null, null, null, null, null);
    }
}
