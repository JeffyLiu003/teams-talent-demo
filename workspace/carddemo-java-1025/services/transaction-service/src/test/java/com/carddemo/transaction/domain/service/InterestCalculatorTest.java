package com.carddemo.transaction.domain.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class InterestCalculatorTest {

    private final InterestCalculator calculator = new InterestCalculator();

    @Test
    void computesMonthlyInterestFromAnnualRate() {
        // BR-INT-01：1200.00 × 18.00 ÷ 1200 = 18.00
        assertThat(calculator.monthlyInterest(new BigDecimal("1200.00"), new BigDecimal("18.00")))
                .isEqualByComparingTo("18.00");
    }

    @Test
    void roundsHalfUpToTwoDecimals() {
        // 33.33 × 18.00 ÷ 1200 = 0.499950 → 0.50
        assertThat(calculator.monthlyInterest(new BigDecimal("33.33"), new BigDecimal("18.00")))
                .isEqualByComparingTo("0.50");
        // 100.05 × 18.00 ÷ 1200 = 1.500750 → 1.50
        assertThat(calculator.monthlyInterest(new BigDecimal("100.05"), new BigDecimal("18.00")))
                .isEqualByComparingTo("1.50");
        // 100.10 × 18.00 ÷ 1200 = 1.501500 → 1.50
        assertThat(calculator.monthlyInterest(new BigDecimal("100.10"), new BigDecimal("18.00")))
                .isEqualByComparingTo("1.50");
        // 100.15 × 18.00 ÷ 1200 = 1.502250 → 1.50
        assertThat(calculator.monthlyInterest(new BigDecimal("100.15"), new BigDecimal("18.00")))
                .isEqualByComparingTo("1.50");
        // 133.40 × 18.00 ÷ 1200 = 2.001000 → 2.00
        assertThat(calculator.monthlyInterest(new BigDecimal("133.40"), new BigDecimal("18.00")))
                .isEqualByComparingTo("2.00");
    }

    @Test
    void returnsZeroWhenRateIsZero() {
        assertThat(calculator.monthlyInterest(new BigDecimal("1500.00"), new BigDecimal("0.00")))
                .isEqualByComparingTo("0.00");
    }
}
