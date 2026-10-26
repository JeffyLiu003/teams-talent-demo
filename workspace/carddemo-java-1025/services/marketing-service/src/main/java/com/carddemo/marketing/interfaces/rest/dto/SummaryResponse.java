package com.carddemo.marketing.interfaces.rest.dto;

import com.carddemo.marketing.application.CampaignApplicationService;

import java.math.BigDecimal;

public record SummaryResponse(long activeCampaigns, long grantedRewards, BigDecimal cashbackTotal,
                              int pointsTotal, long pendingRewards) {

    public static SummaryResponse from(CampaignApplicationService.Summary summary) {
        return new SummaryResponse(summary.activeCampaigns(), summary.grantedRewards(),
                summary.cashbackTotal(), summary.pointsTotal(), summary.pendingRewards());
    }
}
