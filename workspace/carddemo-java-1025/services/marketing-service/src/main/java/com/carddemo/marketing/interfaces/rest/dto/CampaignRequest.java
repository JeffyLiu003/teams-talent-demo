package com.carddemo.marketing.interfaces.rest.dto;

import com.carddemo.marketing.domain.model.CampaignDraft;
import com.carddemo.marketing.domain.model.CampaignType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 活动创建/编辑请求。类型与计价字段的匹配由领域校验（MK-CAM-*）。
 */
public record CampaignRequest(
        @Schema(example = "餐饮消费 5% 返现")
        @NotBlank(message = "Campaign name must be supplied.")
        @Size(max = 80, message = "Campaign name must be 80 characters or less.")
        String name,

        @Size(max = 300, message = "Description must be 300 characters or less.")
        String description,

        @Schema(example = "CATEGORY_CASHBACK")
        @NotNull(message = "Campaign type must be supplied.")
        CampaignType campaignType,

        @NotNull(message = "Start time must be supplied.")
        LocalDateTime startAt,

        @NotNull(message = "End time must be supplied.")
        LocalDateTime endAt,

        @Pattern(regexp = "^$|.{1,10}", message = "Target group must be 10 characters or less.")
        String targetGroupId,

        @Pattern(regexp = "^$|\\d{4}", message = "Category code must be 4 digits.")
        String categoryCode,

        @DecimalMin(value = "0.00", message = "Minimum transaction amount must not be negative.")
        BigDecimal minTransactionAmount,

        @DecimalMin(value = "0.0001", message = "Reward rate must be greater than zero.")
        BigDecimal rewardRate,

        @DecimalMin(value = "0.01", message = "Fixed reward must be greater than zero.")
        BigDecimal fixedRewardAmount,

        @DecimalMin(value = "0.01", message = "Max reward per transaction must be greater than zero.")
        BigDecimal maxRewardPerTransaction,

        @Min(value = 1, message = "Max rewards per card must be greater than zero.")
        Integer maxRewardsPerCard,

        @DecimalMin(value = "0.00", message = "Budget must not be negative.")
        BigDecimal budget,

        @DecimalMin(value = "0.01", message = "Points multiplier must be greater than zero.")
        BigDecimal pointsMultiplier,

        boolean enrollmentRequired) {

    public CampaignDraft toDraft() {
        return new CampaignDraft(name, description, campaignType, startAt, endAt, targetGroupId,
                categoryCode, minTransactionAmount, rewardRate, fixedRewardAmount,
                maxRewardPerTransaction, maxRewardsPerCard, budget, pointsMultiplier, enrollmentRequired);
    }
}
