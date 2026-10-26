package com.carddemo.account.interfaces.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * 营销返现入账请求。rewardId 为幂等键，由营销服务生成。
 */
public record CashbackCreditRequest(
        @Schema(example = "7c1f0d4e-2b0a-4f3e-9f2b-8a1c6d5e4f30")
        @NotBlank(message = "Reward ID must be supplied.")
        String rewardId,

        @Schema(example = "c0000000-0000-0000-0000-000000000002")
        @NotBlank(message = "Campaign ID must be supplied.")
        String campaignId,

        @Schema(example = "6.00")
        @NotNull(message = "Amount must be supplied.")
        @DecimalMin(value = "0.01", message = "Amount must be greater than zero.")
        BigDecimal amount) {
}
