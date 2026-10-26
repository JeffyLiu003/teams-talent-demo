package com.carddemo.marketing.interfaces.rest.dto;

import com.carddemo.marketing.application.CampaignApplicationService;

import java.math.BigDecimal;

public record PerformanceResponse(String campaignId, long enrolledCount, long rewardCount,
                                  long grantedCount, long pendingCount, long failedCount,
                                  BigDecimal cashbackTotal, int pointsTotal, BigDecimal budget,
                                  BigDecimal consumedAmount, BigDecimal budgetUtilization,
                                  BigDecimal conversionRate) {

    public static PerformanceResponse from(CampaignApplicationService.Performance performance) {
        return new PerformanceResponse(performance.campaign().getCampaignId(), performance.enrolledCount(),
                performance.rewardCount(), performance.grantedCount(), performance.pendingCount(),
                performance.failedCount(), performance.cashbackTotal(), performance.pointsTotal(),
                performance.budget(), performance.consumedAmount(),
                performance.budgetUtilization(), performance.conversionRate());
    }
}
