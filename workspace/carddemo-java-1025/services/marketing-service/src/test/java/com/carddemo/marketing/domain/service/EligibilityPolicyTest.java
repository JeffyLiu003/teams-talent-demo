package com.carddemo.marketing.domain.service;

import com.carddemo.marketing.domain.model.AccountSnapshot;
import com.carddemo.marketing.domain.model.Campaign;
import com.carddemo.marketing.domain.model.CampaignDraft;
import com.carddemo.marketing.domain.model.CampaignType;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class EligibilityPolicyTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 25, 10, 0);
    private static final AccountSnapshot ACCOUNT = new AccountSnapshot("00000000001", "Y",
            new BigDecimal("1940.00"), "A000000000");

    private Campaign campaign(CampaignType type, String category, BigDecimal min,
                             BigDecimal rate, BigDecimal fixed, BigDecimal budget,
                             boolean enrollmentRequired, int maxPerCard) {
        CampaignDraft draft = new CampaignDraft("测试", null, type,
                NOW.minusDays(10), NOW.plusDays(10), null, category, min,
                rate, fixed, new BigDecimal("50.00"), maxPerCard, budget, null, enrollmentRequired);
        Campaign campaign = new Campaign("c1", draft, NOW);
        campaign.activate(NOW);
        return campaign;
    }

    private Campaign categoryCampaign() {
        return campaign(CampaignType.CATEGORY_CASHBACK, "0001", new BigDecimal("50.00"),
                new BigDecimal("0.05"), null, new BigDecimal("1000.00"), true, 5);
    }

    @Test
    void eligibleWhenAllConditionsMet() {
        EligibilityPolicy.Evaluation evaluation = EligibilityPolicy.evaluateTransaction(
                categoryCampaign(), ACCOUNT, new BigDecimal("120.00"), "0001", true, 0, NOW);

        assertThat(evaluation.eligible()).isTrue();
        assertThat(evaluation.reward().amount()).isEqualByComparingTo("6.00");
    }

    @Test
    void rejectsNotActiveCampaign() {
        Campaign campaign = new Campaign("c1", new CampaignDraft("测试", null,
                CampaignType.CATEGORY_CASHBACK, NOW.minusDays(1), NOW.plusDays(1), null, "0001",
                BigDecimal.ZERO, new BigDecimal("0.05"), null, null, 1, new BigDecimal("100"),
                null, true), NOW);

        assertThat(EligibilityPolicy.evaluateParticipation(campaign, ACCOUNT, true, NOW).reason())
                .isEqualTo(EligibilityPolicy.NOT_ACTIVE);
    }

    @Test
    void rejectsInactiveAccountAndGroupMismatch() {
        AccountSnapshot inactive = new AccountSnapshot("00000000001", "N",
                BigDecimal.ZERO, "A000000000");
        assertThat(EligibilityPolicy.evaluateParticipation(categoryCampaign(), inactive, true, NOW).reason())
                .isEqualTo(EligibilityPolicy.ACCOUNT_INACTIVE);

        AccountSnapshot otherGroup = new AccountSnapshot("00000000001", "Y",
                BigDecimal.ZERO, "B000000000");
        Campaign targeted = new Campaign("c2", new CampaignDraft("测试", null,
                CampaignType.CATEGORY_CASHBACK, NOW.minusDays(1), NOW.plusDays(1), "A000000000",
                "0001", BigDecimal.ZERO, new BigDecimal("0.05"), null, null, 1,
                new BigDecimal("100"), null, true), NOW);
        targeted.activate(NOW);
        assertThat(EligibilityPolicy.evaluateParticipation(targeted, otherGroup, true, NOW).reason())
                .isEqualTo(EligibilityPolicy.GROUP_MISMATCH);
    }

    @Test
    void rejectsWrongCategoryOrAmount() {
        assertThat(EligibilityPolicy.evaluateTransaction(categoryCampaign(), ACCOUNT,
                new BigDecimal("120.00"), "0002", true, 0, NOW).reason())
                .isEqualTo(EligibilityPolicy.CATEGORY_MISMATCH);
        assertThat(EligibilityPolicy.evaluateTransaction(categoryCampaign(), ACCOUNT,
                new BigDecimal("49.99"), "0001", true, 0, NOW).reason())
                .isEqualTo(EligibilityPolicy.AMOUNT_TOO_LOW);
    }

    @Test
    void rejectsWhenNotEnrolledOrLimitReached() {
        assertThat(EligibilityPolicy.evaluateTransaction(categoryCampaign(), ACCOUNT,
                new BigDecimal("120.00"), "0001", false, 0, NOW).reason())
                .isEqualTo(EligibilityPolicy.NOT_ENROLLED);
        assertThat(EligibilityPolicy.evaluateTransaction(categoryCampaign(), ACCOUNT,
                new BigDecimal("120.00"), "0001", true, 5, NOW).reason())
                .isEqualTo(EligibilityPolicy.CARD_LIMIT_REACHED);
    }

    @Test
    void rejectsFirstPurchaseWhenAlreadyRewarded() {
        Campaign first = campaign(CampaignType.FIRST_PURCHASE_CASHBACK, null,
                new BigDecimal("100.00"), null, new BigDecimal("20.00"),
                new BigDecimal("1000.00"), false, 2);

        assertThat(EligibilityPolicy.evaluateTransaction(first, ACCOUNT,
                new BigDecimal("150.00"), "0001", false, 1, NOW).reason())
                .isEqualTo(EligibilityPolicy.ALREADY_REWARDED);
    }

    @Test
    void rejectsWhenBudgetExhausted() {
        Campaign campaign = campaign(CampaignType.CATEGORY_CASHBACK, "0001",
                new BigDecimal("50.00"), new BigDecimal("0.05"), null,
                new BigDecimal("5.00"), false, 5);

        assertThat(EligibilityPolicy.evaluateTransaction(campaign, ACCOUNT,
                new BigDecimal("120.00"), "0001", false, 0, NOW).reason())
                .isEqualTo(EligibilityPolicy.BUDGET_EXHAUSTED);
    }
}
