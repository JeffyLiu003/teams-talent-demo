package com.carddemo.marketing.domain.model;

import java.math.BigDecimal;

/**
 * 奖励计算结果：现金返现或积分。
 */
public record RewardComputation(RewardType rewardType, BigDecimal amount, int points) {

    public static RewardComputation cashback(BigDecimal amount) {
        return new RewardComputation(RewardType.CASHBACK, amount, 0);
    }

    public static RewardComputation points(int points) {
        return new RewardComputation(RewardType.POINTS, BigDecimal.ZERO.setScale(2), points);
    }
}
