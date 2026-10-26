package com.carddemo.authorization.infrastructure.client;

import com.carddemo.authorization.domain.model.AccountSnapshot;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;

/**
 * account-service 的 AccountResponse 投影（授权只读余额与额度）。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
record AccountBody(
        String accountId,
        String activeStatus,
        BigDecimal currentBalance,
        BigDecimal creditLimit,
        BigDecimal cashCreditLimit) {

    AccountSnapshot toSnapshot() {
        return new AccountSnapshot(accountId, activeStatus, currentBalance, creditLimit, cashCreditLimit);
    }
}
