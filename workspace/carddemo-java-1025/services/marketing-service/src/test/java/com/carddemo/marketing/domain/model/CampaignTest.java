package com.carddemo.marketing.domain.model;

import com.carddemo.marketing.domain.exception.BusinessRuleException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CampaignTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 25, 10, 0);

    static CampaignDraft cashbackDraft() {
        return new CampaignDraft("餐饮返现", "测试", CampaignType.CATEGORY_CASHBACK,
                NOW.minusDays(1), NOW.plusDays(30), null, "0001",
                new BigDecimal("50.00"), new BigDecimal("0.0500"), null,
                new BigDecimal("30.00"), 5, new BigDecimal("1000.00"), null, true);
    }

    @Test
    void createsDraftAndConsumesBudget() {
        Campaign campaign = new Campaign("c1", cashbackDraft(), NOW);

        assertThat(campaign.getStatus()).isEqualTo(CampaignStatus.DRAFT);
        assertThat(campaign.getConsumedAmount()).isEqualByComparingTo("0.00");
        assertThat(campaign.remainingBudget()).isEqualByComparingTo("1000.00");

        campaign.activate(NOW);
        campaign.consumeCashback(new BigDecimal("30.00"));

        assertThat(campaign.getStatus()).isEqualTo(CampaignStatus.ACTIVE);
        assertThat(campaign.getConsumedAmount()).isEqualByComparingTo("30.00");
        assertThat(campaign.remainingBudget()).isEqualByComparingTo("970.00");
    }

    @Test
    void budgetCannotBeExceeded() {
        Campaign campaign = new Campaign("c1", cashbackDraft(), NOW);
        campaign.activate(NOW);

        assertThatThrownBy(() -> campaign.consumeCashback(new BigDecimal("1000.01")))
                .isInstanceOf(BusinessRuleException.class)
                .extracting("code").isEqualTo("BUDGET_EXHAUSTED");
    }

    @Test
    void stateMachineOnlyAllowsLegalTransitions() {
        Campaign campaign = new Campaign("c1", cashbackDraft(), NOW);

        assertThatThrownBy(() -> campaign.pause(NOW))
                .isInstanceOf(BusinessRuleException.class);
        campaign.activate(NOW);
        assertThatThrownBy(() -> campaign.activate(NOW))
                .isInstanceOf(BusinessRuleException.class);
        campaign.pause(NOW);
        campaign.activate(NOW);
        campaign.end(NOW);
        assertThat(campaign.getStatus()).isEqualTo(CampaignStatus.ENDED);
        assertThatThrownBy(() -> campaign.activate(NOW))
                .isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void cannotEditActiveCampaign() {
        Campaign campaign = new Campaign("c1", cashbackDraft(), NOW);
        campaign.activate(NOW);

        assertThatThrownBy(() -> campaign.applyDraft(cashbackDraft(), NOW))
                .isInstanceOf(BusinessRuleException.class)
                .extracting("code").isEqualTo("CAMPAIGN_NOT_EDITABLE");
    }

    @Test
    void rejectsInvalidPeriodAndMissingReward() {
        CampaignDraft badPeriod = new CampaignDraft("x", null, CampaignType.CATEGORY_CASHBACK,
                NOW, NOW.minusDays(1), null, "0001", BigDecimal.ZERO,
                new BigDecimal("0.05"), null, null, 1, new BigDecimal("100"), null, true);
        assertThatThrownBy(() -> new Campaign("c1", badPeriod, NOW))
                .isInstanceOf(BusinessRuleException.class)
                .extracting("code").isEqualTo("INVALID_CAMPAIGN_PERIOD");

        CampaignDraft noReward = new CampaignDraft("x", null, CampaignType.CATEGORY_CASHBACK,
                NOW.minusDays(1), NOW.plusDays(1), null, "0001", BigDecimal.ZERO,
                null, null, null, 1, new BigDecimal("100"), null, true);
        assertThatThrownBy(() -> new Campaign("c1", noReward, NOW))
                .isInstanceOf(BusinessRuleException.class)
                .extracting("code").isEqualTo("INVALID_CAMPAIGN_RULE");
    }

    @Test
    void rejectsCashbackWithoutBudget() {
        CampaignDraft draft = new CampaignDraft("x", null, CampaignType.CATEGORY_CASHBACK,
                NOW.minusDays(1), NOW.plusDays(1), null, "0001", BigDecimal.ZERO,
                new BigDecimal("0.05"), null, null, 1, BigDecimal.ZERO, null, true);
        assertThatThrownBy(() -> new Campaign("c1", draft, NOW))
                .isInstanceOf(BusinessRuleException.class)
                .extracting("code").isEqualTo("BUDGET_REQUIRED");
    }
}
