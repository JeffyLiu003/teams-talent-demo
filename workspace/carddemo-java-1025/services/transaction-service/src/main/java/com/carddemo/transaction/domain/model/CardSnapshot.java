package com.carddemo.transaction.domain.model;

import java.time.LocalDate;

/**
 * 卡片快照（card-service 只读投影）。卡号→账户映射归 card-service（BR-ACCT-07）。
 */
public record CardSnapshot(
        String cardNumber,
        String accountId,
        String customerId,
        String embossedName,
        LocalDate expiryDate,
        String activeStatus) {
}
