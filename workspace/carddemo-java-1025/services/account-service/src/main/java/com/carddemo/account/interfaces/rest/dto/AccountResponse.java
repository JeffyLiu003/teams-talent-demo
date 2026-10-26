package com.carddemo.account.interfaces.rest.dto;

import com.carddemo.account.domain.model.Account;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AccountResponse(
        String accountId,
        String activeStatus,
        BigDecimal currentBalance,
        BigDecimal creditLimit,
        BigDecimal cashCreditLimit,
        LocalDate openDate,
        LocalDate expirationDate,
        LocalDate reissueDate,
        BigDecimal currentCycleCredit,
        BigDecimal currentCycleDebit,
        String addressZip,
        String groupId,
        long version) {

    public static AccountResponse from(Account account) {
        return new AccountResponse(
                account.getAccountId(),
                account.getActiveStatus(),
                account.getCurrentBalance(),
                account.getCreditLimit(),
                account.getCashCreditLimit(),
                account.getOpenDate(),
                account.getExpirationDate(),
                account.getReissueDate(),
                account.getCurrentCycleCredit(),
                account.getCurrentCycleDebit(),
                account.getAddressZip(),
                account.getGroupId(),
                account.getVersion());
    }
}
