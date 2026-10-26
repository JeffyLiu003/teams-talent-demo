package com.carddemo.marketing.interfaces.rest.dto;

import com.carddemo.marketing.application.EvaluationCommand;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 奖励评估请求：由交易入账成功后调用，也可用于演示手工触发。
 */
public record EvaluationRequest(
        @Schema(example = "0000000000000100")
        @NotBlank(message = "Transaction ID must be supplied.")
        String transactionId,

        @Schema(example = "3344556677889900")
        @NotBlank(message = "Card Number must be supplied.")
        @Pattern(regexp = "\\d{16}", message = "Card Number must be 16 digits.")
        String cardNumber,

        @Schema(example = "00000000006")
        @NotBlank(message = "Account ID must be supplied.")
        @Pattern(regexp = "\\d{11}", message = "Account ID must be 11 digits.")
        String accountId,

        @Pattern(regexp = "^$|\\d{9}", message = "Customer ID must be 9 digits.")
        String customerId,

        @NotNull
        @DecimalMin(value = "0.01", message = "Amount must be greater than zero.")
        @Digits(integer = 10, fraction = 2)
        BigDecimal amount,

        @Schema(example = "0001")
        @Pattern(regexp = "^$|\\d{4}", message = "Category code must be 4 digits.")
        String categoryCode,

        @Pattern(regexp = "^$|\\d{2}", message = "Type code must be 2 digits.")
        String typeCode,

        String description,

        LocalDateTime processedAt) {

    public EvaluationCommand toCommand() {
        return new EvaluationCommand(transactionId, cardNumber, accountId, customerId, amount,
                categoryCode, typeCode, description, processedAt);
    }
}
