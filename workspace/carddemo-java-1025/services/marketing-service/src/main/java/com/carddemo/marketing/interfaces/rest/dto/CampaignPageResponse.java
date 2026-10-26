package com.carddemo.marketing.interfaces.rest.dto;

import com.carddemo.marketing.domain.model.Campaign;
import com.carddemo.marketing.domain.repository.PageResult;

import java.math.BigDecimal;
import java.util.List;

public record CampaignPageResponse(List<Item> items, int page, int size, long total) {

    public record Item(String campaignId, String name, String description, String campaignType,
                       String status, String startAt, String endAt, String categoryCode,
                       BigDecimal budget, BigDecimal consumedAmount, BigDecimal remainingBudget,
                       boolean enrollmentRequired, String rewardSummary) {

        static Item from(Campaign campaign) {
            return new Item(campaign.getCampaignId(), campaign.getName(), campaign.getDescription(),
                    campaign.getCampaignType().name(), campaign.getStatus().name(),
                    campaign.getStartAt().toString(), campaign.getEndAt().toString(),
                    campaign.getCategoryCode(), campaign.getBudget(), campaign.getConsumedAmount(),
                    campaign.remainingBudget(), campaign.isEnrollmentRequired(),
                    summarize(campaign));
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
    }

    public static CampaignPageResponse from(PageResult<Campaign> page) {
        return new CampaignPageResponse(page.items().stream().map(Item::from).toList(),
                page.page(), page.size(), page.total());
    }
}
