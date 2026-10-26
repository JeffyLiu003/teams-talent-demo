package com.carddemo.account.interfaces.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * 还款 / 利息入账金额请求。
 */
public record AmountRequest(
        @Schema(description = "还款金额（账单支付场景等于账户当前余额）或利息入账金额",
                example = "1940.00",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "Amount must be supplied.")
        @DecimalMin(value = "0.00", message = "Amount must not be negative.")
        BigDecimal amount) {
}
