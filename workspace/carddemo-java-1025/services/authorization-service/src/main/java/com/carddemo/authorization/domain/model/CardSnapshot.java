package com.carddemo.authorization.domain.model;

import java.time.LocalDate;

/**
 * 卡片快照（card-service 只读投影）。卡号→账户/客户映射归 card-service（BR-AUTH-01）。
 */
public record CardSnapshot(
        String cardNumber,
        String accountId,
        String customerId,
        String activeStatus,
        LocalDate expiryDate) {
}
