package com.carddemo.authorization.domain.service;

import com.carddemo.authorization.domain.exception.BusinessRuleException;
import com.carddemo.authorization.domain.model.AccountSnapshot;
import com.carddemo.authorization.domain.model.AuthorizationSummary;
import com.carddemo.authorization.domain.model.CardSnapshot;
import com.carddemo.authorization.domain.model.CustomerSnapshot;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * BR-AUTH-01..09：决策与原因码优先级（纯 JUnit，无 Spring）。
 */
class AuthorizationPolicyTest {

    private static final BigDecimal CREDIT_LIMIT = new BigDecimal("2020.00");
    private static final BigDecimal CURRENT_BALANCE = new BigDecimal("1940.00");

    private final AuthorizationPolicy policy = new AuthorizationPolicy();

    private final CardSnapshot card = new CardSnapshot("0500024453765740", "00000000001", "000000001",
            "Y", LocalDate.of(2028, 5, 20));

    private final CustomerSnapshot customer = new CustomerSnapshot("000000001");

    private final AccountSnapshot account = new AccountSnapshot("00000000001", "Y",
            CURRENT_BALANCE, CREDIT_LIMIT, new BigDecimal("1020.00"));

    @Test
    void approvesAmountWithinAvailableCredit() {
        AuthorizationPolicy.Decision decision = policy.decide(card, customer, account, null, false,
                new BigDecimal("80.00"));

        assertThat(decision.responseCode()).isEqualTo("00");
        assertThat(decision.reasonCode()).isEqualTo("0000");
        assertThat(decision.approvedAmount()).isEqualByComparingTo("80.00");
    }

    @Test
    void declinesWith3100WhenCardDoesNotExist() {
        AuthorizationPolicy.Decision decision = policy.decide(null, customer, account, null, false,
                new BigDecimal("10.00"));

        assertThat(decision.responseCode()).isEqualTo("05");
        assertThat(decision.reasonCode()).isEqualTo("3100");
        assertThat(decision.approvedAmount()).isEqualByComparingTo("0.00");
    }

    @Test
    void declinesWith3100WhenCustomerDoesNotExist() {
        AuthorizationPolicy.Decision decision = policy.decide(card, null, account, null, false,
                new BigDecimal("10.00"));

        assertThat(decision.responseCode()).isEqualTo("05");
        assertThat(decision.reasonCode()).isEqualTo("3100");
    }

    @Test
    void declinesWith3100WhenAccountDoesNotExist() {
        AuthorizationPolicy.Decision decision = policy.decide(card, customer, null, null, false,
                new BigDecimal("10.00"));

        assertThat(decision.responseCode()).isEqualTo("05");
        assertThat(decision.reasonCode()).isEqualTo("3100");
    }

    @Test
    void declinesWith4100WhenAmountExceedsAvailableCredit() {
        AuthorizationPolicy.Decision decision = policy.decide(card, customer, account, null, false,
                new BigDecimal("80.01"));

        assertThat(decision.responseCode()).isEqualTo("05");
        assertThat(decision.reasonCode()).isEqualTo("4100");
        assertThat(decision.approvedAmount()).isEqualByComparingTo("0.00");
    }

    @Test
    void declinesWith4100WhenPendingSummaryConsumesCredit() {
        AuthorizationSummary summary = new AuthorizationSummary("00000000001", CREDIT_LIMIT,
                new BigDecimal("1020.00"));
        summary.applyApproved(new BigDecimal("2000.00"));

        AuthorizationPolicy.Decision decision = policy.decide(card, customer, account, summary, false,
                new BigDecimal("30.00"));

        assertThat(decision.reasonCode()).isEqualTo("4100");
    }

    @Test
    void subtractsAccountBalanceAndPendingApprovalsTogether() {
        AuthorizationSummary summary = new AuthorizationSummary("00000000001", CREDIT_LIMIT,
                new BigDecimal("1020.00"));
        summary.applyApproved(new BigDecimal("50.00"));

        AuthorizationPolicy.Decision decision = policy.decide(card, customer, account, summary, false,
                new BigDecimal("50.00"));

        assertThat(decision.responseCode()).isEqualTo("05");
        assertThat(decision.reasonCode()).isEqualTo("4100");
    }

    @Test
    void declinesWith4200WhenCardIsNotActive() {
        CardSnapshot inactive = new CardSnapshot(card.cardNumber(), card.accountId(), card.customerId(),
                "N", card.expiryDate());

        AuthorizationPolicy.Decision decision = policy.decide(inactive, customer, account, null, false,
                new BigDecimal("80.00"));

        assertThat(decision.responseCode()).isEqualTo("05");
        assertThat(decision.reasonCode()).isEqualTo("4200");
    }

    @Test
    void declinesWith4300WhenAccountIsClosed() {
        AccountSnapshot closed = new AccountSnapshot("00000000001", "N", CURRENT_BALANCE, CREDIT_LIMIT,
                new BigDecimal("1020.00"));

        AuthorizationPolicy.Decision decision = policy.decide(card, customer, closed, null, false,
                new BigDecimal("80.00"));

        assertThat(decision.responseCode()).isEqualTo("05");
        assertThat(decision.reasonCode()).isEqualTo("4300");
    }

    @Test
    void declinesWith5100WhenCardIsFraudFlagged() {
        AuthorizationPolicy.Decision decision = policy.decide(card, customer, account, null, true,
                new BigDecimal("80.00"));

        assertThat(decision.responseCode()).isEqualTo("05");
        assertThat(decision.reasonCode()).isEqualTo("5100");
    }

    /**
     * BR-AUTH-09：额度不足（4100）优先于卡未激活（4200）。
     */
    @Test
    void prioritisesInsufficientFundOverInactiveCard() {
        CardSnapshot inactive = new CardSnapshot(card.cardNumber(), card.accountId(), card.customerId(),
                "N", card.expiryDate());

        AuthorizationPolicy.Decision decision = policy.decide(inactive, customer, account, null, false,
                new BigDecimal("500.00"));

        assertThat(decision.reasonCode()).isEqualTo("4100");
    }

    @Test
    void rejectsNonPositiveTransactionAmount() {
        assertThatThrownBy(() -> policy.decide(card, customer, account, null, false, new BigDecimal("0.00")))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("greater than zero");
    }
}
