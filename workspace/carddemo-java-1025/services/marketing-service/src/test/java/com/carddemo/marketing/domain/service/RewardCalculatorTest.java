package com.carddemo.marketing.domain.service;

import com.carddemo.marketing.domain.model.Campaign;
import com.carddemo.marketing.domain.model.CampaignDraft;
import com.carddemo.marketing.domain.model.CampaignType;
import com.carddemo.marketing.domain.model.RewardComputation;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class RewardCalculatorTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 25, 10, 0);

    private Campaign campaign(CampaignType type, BigDecimal rate, BigDecimal fixed,
                              BigDecimal maxPerTxn, BigDecimal multiplier) {
        CampaignDraft draft = new CampaignDraft("测试", null, type,
                NOW.minusDays(1), NOW.plusDays(1), null, null, BigDecimal.ZERO,
                rate, fixed, maxPerTxn, 3, new BigDecimal("1000.00"), multiplier, false);
        return new Campaign("c1", draft, NOW);
    }

    @Test
    void fixedRewardWins() {
        RewardComputation reward = RewardCalculator.compute(
                campaign(CampaignType.FIRST_PURCHASE_CASHBACK, null, new BigDecimal("20.00"), null, null),
                new BigDecimal("150.00"));

        assertThat(reward.amount()).isEqualByComparingTo("20.00");
        assertThat(reward.points()).isZero();
    }

    @Test
    void rateIsRoundedAndCapped() {
        Campaign campaign = campaign(CampaignType.CATEGORY_CASHBACK, new BigDecimal("0.0500"),
                null, new BigDecimal("30.00"), null);

        assertThat(RewardCalculator.compute(campaign, new BigDecimal("120.00")).amount())
                .isEqualByComparingTo("6.00");
        assertThat(RewardCalculator.compute(campaign, new BigDecimal("1000.00")).amount())
                .isEqualByComparingTo("30.00");
        assertThat(RewardCalculator.compute(campaign, new BigDecimal("50.55")).amount())
                .isEqualByComparingTo("2.53");
    }

    @Test
    void pointsUseFloorMultiplication() {
        RewardComputation reward = RewardCalculator.compute(
                campaign(CampaignType.POINTS_MULTIPLIER, null, null, null, new BigDecimal("2.00")),
                new BigDecimal("120.75"));

        assertThat(reward.points()).isEqualTo(241);
        assertThat(reward.amount()).isEqualByComparingTo("0.00");
    }
}
