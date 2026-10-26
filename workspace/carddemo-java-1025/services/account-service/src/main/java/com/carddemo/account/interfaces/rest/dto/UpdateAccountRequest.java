package com.carddemo.account.interfaces.rest.dto;

import com.carddemo.account.domain.model.AccountDetails;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 账户维护请求。R-ACTUP-08/09/10：状态 Y/N、五个金额必填、三个日期必填且为 YYYY-MM-DD。
 */
public record UpdateAccountRequest(
        @NotNull
        @Pattern(regexp = "[YN]", message = "Account Status must be Y or N.")
        String activeStatus,

        @NotNull(message = "Current Balance must be supplied.")
        BigDecimal currentBalance,

        @NotNull(message = "Credit Limit must be supplied.")
        BigDecimal creditLimit,

        @NotNull(message = "Cash Credit Limit must be supplied.")
        BigDecimal cashCreditLimit,

        @NotNull(message = "Open Date must be supplied.")
        LocalDate openDate,

        @NotNull(message = "Expiration Date must be supplied.")
        LocalDate expirationDate,

        @NotNull(message = "Reissue Date must be supplied.")
        LocalDate reissueDate,

        @NotNull(message = "Current Cycle Credit Limit must be supplied.")
        BigDecimal currentCycleCredit,

        @NotNull(message = "Current Cycle Debit Limit must be supplied.")
        BigDecimal currentCycleDebit,

        @Size(max = 10)
        String addressZip,

        @Size(max = 10)
        String groupId) {

    public AccountDetails toDetails() {
        return new AccountDetails(activeStatus, currentBalance, creditLimit, cashCreditLimit,
                openDate, expirationDate, reissueDate, currentCycleCredit, currentCycleDebit,
                addressZip, groupId);
    }
}
