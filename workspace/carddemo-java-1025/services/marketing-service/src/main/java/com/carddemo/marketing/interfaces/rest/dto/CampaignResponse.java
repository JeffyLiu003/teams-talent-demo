package com.carddemo.marketing.interfaces.rest.dto;

import com.carddemo.marketing.domain.model.Campaign;
import com.carddemo.marketing.domain.model.CampaignStatus;
import com.carddemo.marketing.domain.model.CampaignType;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CampaignResponse(
        String campaignId,
        String name,
        String description,
        CampaignType campaignType,
        CampaignStatus status,
        LocalDateTime startAt,
        LocalDateTime endAt,
        String targetGroupId,
        String categoryCode,
        BigDecimal minTransactionAmount,
        BigDecimal rewardRate,
        BigDecimal fixedRewardAmount,
        BigDecimal maxRewardPerTransaction,
        Integer maxRewardsPerCard,
        BigDecimal budget,
        BigDecimal consumedAmount,
        BigDecimal remainingBudget,
        BigDecimal pointsMultiplier,
        boolean enrollmentRequired,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        long version) {

    public static CampaignResponse from(Campaign campaign) {
        return new CampaignResponse(campaign.getCampaignId(), campaign.getName(), campaign.getDescription(),
                campaign.getCampaignType(), campaign.getStatus(), campaign.getStartAt(),
                campaign.getEndAt(), campaign.getTargetGroupId(), campaign.getCategoryCode(),
                campaign.getMinTransactionAmount(), campaign.getRewardRate(),
                campaign.getFixedRewardAmount(), campaign.getMaxRewardPerTransaction(),
                campaign.getMaxRewardsPerCard(), campaign.getBudget(), campaign.getConsumedAmount(),
                campaign.remainingBudget(), campaign.getPointsMultiplier(),
                campaign.isEnrollmentRequired(), campaign.getCreatedAt(), campaign.getUpdatedAt(),
                campaign.getVersion());
    }
}
