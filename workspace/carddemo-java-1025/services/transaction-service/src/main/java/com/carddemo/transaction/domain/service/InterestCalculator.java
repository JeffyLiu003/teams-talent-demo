package com.carddemo.transaction.domain.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * 利息计算（BR-INT-01）：月利息 = 类别累计余额 × 年利率 ÷ 1200，HALF_UP 保留 2 位。
 * 纯领域服务：不依赖 Spring。
 */
public class InterestCalculator {

    private static final BigDecimal MONTHS_PER_YEAR_RATE_DIVISOR = new BigDecimal("1200");
    private static final BigDecimal ZERO = new BigDecimal("0.00");

    public BigDecimal monthlyInterest(BigDecimal balance, BigDecimal annualRatePercent) {
        if (balance == null || annualRatePercent == null || balance.signum() == 0) {
            return ZERO.setScale(2);
        }
        return balance.multiply(annualRatePercent)
                .divide(MONTHS_PER_YEAR_RATE_DIVISOR, 2, RoundingMode.HALF_UP);
    }
}
