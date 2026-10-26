package com.carddemo.account.domain.model;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 账户可修改字段集合，对应 COACTUPC 屏幕上的账户部分（客户部分归 customer-service）。
 */
public record AccountDetails(
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
        String groupId) {
}
