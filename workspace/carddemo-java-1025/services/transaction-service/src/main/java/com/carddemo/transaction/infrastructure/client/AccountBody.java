package com.carddemo.transaction.infrastructure.client;

import com.carddemo.transaction.domain.model.AccountSnapshot;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * account-service 的 AccountResponse 投影。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
record AccountBody(
        String accountId,
        String activeStatus,
        BigDecimal currentBalance,
        BigDecimal creditLimit,
        BigDecimal cashCreditLimit,
        BigDecimal currentCycleCredit,
        BigDecimal currentCycleDebit,
        LocalDate expirationDate,
        String groupId) {

    AccountSnapshot toSnapshot() {
        return new AccountSnapshot(accountId, activeStatus, currentBalance, creditLimit, cashCreditLimit,
                currentCycleCredit, currentCycleDebit, expirationDate, groupId);
    }
}
