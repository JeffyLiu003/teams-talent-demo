package com.carddemo.marketing.domain.service;

import com.carddemo.marketing.domain.model.Campaign;
import com.carddemo.marketing.domain.model.CampaignType;
import com.carddemo.marketing.domain.model.RewardComputation;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * MK-REW-02：奖励计价。现金返现取固定额或比例（单笔封顶），积分取倍数向下取整。
 */
public final class RewardCalculator {

    private RewardCalculator() {
    }

    public static RewardComputation compute(Campaign campaign, BigDecimal transactionAmount) {
        if (campaign.getCampaignType() == CampaignType.POINTS_MULTIPLIER) {
            int points = transactionAmount.multiply(campaign.getPointsMultiplier())
                    .setScale(0, RoundingMode.DOWN)
                    .intValue();
            return RewardComputation.points(points);
        }

        BigDecimal reward;
        if (campaign.getFixedRewardAmount() != null && campaign.getFixedRewardAmount().signum() > 0) {
            reward = campaign.getFixedRewardAmount();
        } else if (campaign.getRewardRate() != null) {
            reward = transactionAmount.multiply(campaign.getRewardRate())
                    .setScale(2, RoundingMode.HALF_UP);
        } else {
            reward = BigDecimal.ZERO.setScale(2);
        }
        if (campaign.getMaxRewardPerTransaction() != null) {
            reward = reward.min(campaign.getMaxRewardPerTransaction());
        }
        return RewardComputation.cashback(reward.setScale(2, RoundingMode.HALF_UP));
    }
}
