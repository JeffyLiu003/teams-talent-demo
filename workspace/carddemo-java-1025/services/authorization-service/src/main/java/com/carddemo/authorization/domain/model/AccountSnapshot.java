package com.carddemo.authorization.domain.model;

import java.math.BigDecimal;

/**
 * 账户快照（account-service 只读投影）。余额与额度唯一权威在 account-service。
 */
public record AccountSnapshot(
        String accountId,
        String activeStatus,
        BigDecimal currentBalance,
        BigDecimal creditLimit,
        BigDecimal cashCreditLimit) {
}
