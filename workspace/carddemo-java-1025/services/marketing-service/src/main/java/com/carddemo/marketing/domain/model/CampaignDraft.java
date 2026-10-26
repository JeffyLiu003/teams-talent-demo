package com.carddemo.marketing.domain.model;

import java.math.BigDecimal;

/**
 * 单个活动的规则草案，用于新建/编辑。
 */
public record CampaignDraft(
        String name,
        String description,
        CampaignType campaignType,
        java.time.LocalDateTime startAt,
        java.time.LocalDateTime endAt,
        String targetGroupId,
        String categoryCode,
        BigDecimal minTransactionAmount,
        BigDecimal rewardRate,
        BigDecimal fixedRewardAmount,
        BigDecimal maxRewardPerTransaction,
        Integer maxRewardsPerCard,
        BigDecimal budget,
        BigDecimal pointsMultiplier,
        boolean enrollmentRequired) {
}
