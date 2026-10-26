package com.carddemo.transaction.domain.service;

import com.carddemo.transaction.domain.model.AccountSnapshot;
import com.carddemo.transaction.domain.model.CardSnapshot;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class PostingPolicyTest {

    private static final LocalDate ORIGINAL_DATE = LocalDate.of(2026, 9, 15);

    private final PostingPolicy policy = new PostingPolicy();

    private final CardSnapshot card = new CardSnapshot("0500024453765740", "00000000001", "000000001",
            "IMMANUEL KESSLER", LocalDate.of(2028, 5, 20), "Y");

    private AccountSnapshot account(String creditLimit, String cycleCredit, String cycleDebit,
                                    LocalDate expirationDate) {
        return new AccountSnapshot("00000000001", "Y", new BigDecimal("1940.00"),
                new BigDecimal(creditLimit), new BigDecimal("1020.00"), new BigDecimal(cycleCredit),
                new BigDecimal(cycleDebit), expirationDate, "A000000000");
    }

    @Test
    void rejectsWhenCardDoesNotExist() {
        assertThat(policy.evaluate(null, account("2020.00", "0.00", "0.00", LocalDate.of(2028, 5, 20)),
                new BigDecimal("10.00"), ORIGINAL_DATE))
                .hasValueSatisfying(reason -> {
                    assertThat(reason.getCode()).isEqualTo(100);
                    assertThat(reason.getDescription()).isEqualTo("INVALID CARD NUMBER FOUND");
                });
    }

    @Test
    void rejectsWhenAccountDoesNotExist() {
        assertThat(policy.evaluate(card, null, new BigDecimal("10.00"), ORIGINAL_DATE))
                .hasValueSatisfying(reason -> {
                    assertThat(reason.getCode()).isEqualTo(101);
                    assertThat(reason.getDescription()).isEqualTo("ACCOUNT RECORD NOT FOUND");
                });
    }

    @Test
    void rejectsWhenProjectedCycleExceedsCreditLimit() {
        assertThat(policy.evaluate(card, account("2020.00", "1900.00", "0.00", LocalDate.of(2028, 5, 20)),
                new BigDecimal("120.01"), ORIGINAL_DATE))
                .hasValueSatisfying(reason -> {
                    assertThat(reason.getCode()).isEqualTo(102);
                    assertThat(reason.getDescription()).isEqualTo("OVERLIMIT TRANSACTION");
                });
    }

    @Test
    void rejectsWhenAccountExpiredBeforeOriginalDate() {
        assertThat(policy.evaluate(card, account("5000.00", "0.00", "0.00", LocalDate.of(2026, 9, 14)),
                new BigDecimal("10.00"), ORIGINAL_DATE))
                .hasValueSatisfying(reason -> {
                    assertThat(reason.getCode()).isEqualTo(103);
                    assertThat(reason.getDescription())
                            .isEqualTo("TRANSACTION RECEIVED AFTER ACCT EXPIRATION");
                });
    }

    @Test
    void acceptsTransactionWithinLimitAndBeforeExpiration() {
        assertThat(policy.evaluate(card, account("2020.00", "1900.00", "0.00", LocalDate.of(2028, 5, 20)),
                new BigDecimal("120.00"), ORIGINAL_DATE))
                .isEmpty();
    }
}
