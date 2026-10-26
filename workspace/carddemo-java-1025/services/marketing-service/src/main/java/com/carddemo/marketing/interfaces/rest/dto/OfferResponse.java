package com.carddemo.marketing.interfaces.rest.dto;

import com.carddemo.marketing.application.MarketingQueryService;
import com.carddemo.marketing.domain.model.Campaign;

import java.math.BigDecimal;
import java.util.List;

public record OfferResponse(
        String campaignId,
        String name,
        String description,
        String campaignType,
        String rewardSummary,
        String rewardType,
        BigDecimal rewardRate,
        BigDecimal fixedRewardAmount,
        BigDecimal maxRewardPerTransaction,
        BigDecimal pointsMultiplier,
        BigDecimal minTransactionAmount,
        Integer maxRewardsPerCard,
        String categoryCode,
        String startAt,
        String endAt,
        BigDecimal remainingBudget,
        boolean enrollmentRequired,
        boolean enrolled,
        boolean eligible,
        String reason) {

    public static OfferResponse from(MarketingQueryService.OfferView view) {
        Campaign campaign = view.campaign();
        return new OfferResponse(campaign.getCampaignId(), campaign.getName(), campaign.getDescription(),
                campaign.getCampaignType().name(), summarize(campaign),
                campaign.isCashback() ? "CASHBACK" : "POINTS",
                campaign.getRewardRate(), campaign.getFixedRewardAmount(),
                campaign.getMaxRewardPerTransaction(), campaign.getPointsMultiplier(),
                campaign.getMinTransactionAmount(), campaign.getMaxRewardsPerCard(),
                campaign.getCategoryCode(), campaign.getStartAt().toString(),
                campaign.getEndAt().toString(), campaign.remainingBudget(),
                campaign.isEnrollmentRequired(), view.enrolled(), view.eligible(), view.reason());
    }

    private static String summarize(Campaign campaign) {
        return switch (campaign.getCampaignType()) {
            case POINTS_MULTIPLIER -> campaign.getPointsMultiplier().stripTrailingZeros().toPlainString()
                    + " 倍积分";
            case FIRST_PURCHASE_CASHBACK -> "首刷返 " + campaign.getFixedRewardAmount().toPlainString();
            case CATEGORY_CASHBACK -> campaign.getFixedRewardAmount() != null
                    && campaign.getFixedRewardAmount().signum() > 0
                    ? "返 " + campaign.getFixedRewardAmount().toPlainString()
                    : (campaign.getRewardRate().multiply(new BigDecimal("100")).stripTrailingZeros()
                    .toPlainString() + "% 返现"
                    + (campaign.getMaxRewardPerTransaction() == null ? ""
                    : "，单笔上限 " + campaign.getMaxRewardPerTransaction().toPlainString()));
        };
    }

    public record ListResponse(List<OfferResponse> items) {
    }
}
