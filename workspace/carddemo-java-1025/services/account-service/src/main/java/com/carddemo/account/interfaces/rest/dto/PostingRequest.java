package com.carddemo.account.interfaces.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * 记账请求（BR-POST-006）。amount 正数记入本期贷方，负数记入本期借方。
 */
public record PostingRequest(
        @Schema(description = "记账金额；正数计入本期贷方，负数计入本期借方",
                example = "125.40",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "Amount must be supplied.")
        BigDecimal amount) {
}
