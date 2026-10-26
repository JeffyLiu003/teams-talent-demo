package com.carddemo.transaction.domain.model;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 账户快照（account-service 只读投影）。额度与余额的唯一权威在 account-service。
 */
public record AccountSnapshot(
        String accountId,
        String activeStatus,
        BigDecimal currentBalance,
        BigDecimal creditLimit,
        BigDecimal cashCreditLimit,
        BigDecimal currentCycleCredit,
        BigDecimal currentCycleDebit,
        LocalDate expirationDate,
        String groupId) {
}
