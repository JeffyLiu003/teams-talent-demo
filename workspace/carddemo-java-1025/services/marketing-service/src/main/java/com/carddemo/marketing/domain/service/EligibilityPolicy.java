package com.carddemo.marketing.domain.service;

import com.carddemo.marketing.domain.model.AccountSnapshot;
import com.carddemo.marketing.domain.model.Campaign;
import com.carddemo.marketing.domain.model.CampaignType;
import com.carddemo.marketing.domain.model.RewardComputation;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * MK-ELI-01..09：资格判定。判定顺序即原因码优先级；命中第一个不满足条件即返回。
 */
public final class EligibilityPolicy {

    public static final String NOT_ACTIVE = "CAMPAIGN_NOT_ACTIVE";
    public static final String ACCOUNT_NOT_FOUND = "ACCOUNT_NOT_FOUND";
    public static final String ACCOUNT_INACTIVE = "ACCOUNT_INACTIVE";
    public static final String GROUP_MISMATCH = "ACCOUNT_GROUP_MISMATCH";
    public static final String CATEGORY_MISMATCH = "CATEGORY_MISMATCH";
    public static final String AMOUNT_TOO_LOW = "AMOUNT_TOO_LOW";
    public static final String NOT_ENROLLED = "NOT_ENROLLED";
    public static final String CARD_LIMIT_REACHED = "CARD_LIMIT_REACHED";
    public static final String ALREADY_REWARDED = "FIRST_PURCHASE_ALREADY_REWARDED";
    public static final String BUDGET_EXHAUSTED = "BUDGET_EXHAUSTED";
    public static final String REWARD_ZERO = "REWARD_ZERO";

    private EligibilityPolicy() {
    }

    public record Evaluation(boolean eligible, String reason, RewardComputation reward) {

        static Evaluation eligible(RewardComputation reward) {
            return new Evaluation(true, null, reward);
        }

        static Evaluation rejected(String reason) {
            return new Evaluation(false, reason, null);
        }
    }

    /**
     * 活动中心用：只判断"能否参与"，不含具体交易金额/类别。
     */
    public static Evaluation evaluateParticipation(Campaign campaign, AccountSnapshot account,
                                                   boolean enrolled, LocalDateTime now) {
        if (!campaign.isActiveAt(now)) {
            return Evaluation.rejected(NOT_ACTIVE);
        }
        if (account == null) {
            return Evaluation.rejected(ACCOUNT_NOT_FOUND);
        }
        if (!"Y".equals(account.activeStatus())) {
            return Evaluation.rejected(ACCOUNT_INACTIVE);
        }
        if (!campaign.matchesGroup(account.groupId())) {
            return Evaluation.rejected(GROUP_MISMATCH);
        }
        if (campaign.isEnrollmentRequired() && !enrolled) {
            return Evaluation.rejected(NOT_ENROLLED);
        }
        return Evaluation.eligible(null);
    }

    /**
     * 交易发生后用：完整判定并计算奖励。
     */
    public static Evaluation evaluateTransaction(Campaign campaign, AccountSnapshot account,
                                                 BigDecimal transactionAmount, String categoryCode,
                                                 boolean enrolled, long rewardsOnCard,
                                                 LocalDateTime now) {
        Evaluation participation = evaluateParticipation(campaign, account, enrolled, now);
        if (!participation.eligible()) {
            return participation;
        }
        if (!campaign.matchesCategory(categoryCode)) {
            return Evaluation.rejected(CATEGORY_MISMATCH);
        }
        if (transactionAmount.compareTo(campaign.getMinTransactionAmount()) < 0) {
            return Evaluation.rejected(AMOUNT_TOO_LOW);
        }
        if (campaign.getMaxRewardsPerCard() != null
                && rewardsOnCard >= campaign.getMaxRewardsPerCard()) {
            return Evaluation.rejected(CARD_LIMIT_REACHED);
        }
        if (campaign.getCampaignType() == CampaignType.FIRST_PURCHASE_CASHBACK && rewardsOnCard > 0) {
            return Evaluation.rejected(ALREADY_REWARDED);
        }

        RewardComputation reward = RewardCalculator.compute(campaign, transactionAmount);
        if (reward.amount().signum() <= 0 && reward.points() <= 0) {
            return Evaluation.rejected(REWARD_ZERO);
        }
        if (!campaign.hasBudgetFor(reward.amount())) {
            return Evaluation.rejected(BUDGET_EXHAUSTED);
        }
        return Evaluation.eligible(reward);
    }
}
