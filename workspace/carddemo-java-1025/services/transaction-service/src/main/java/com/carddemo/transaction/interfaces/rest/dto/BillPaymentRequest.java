package com.carddemo.transaction.interfaces.rest.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * 账单支付请求。confirm 为 false/缺省时返回 409 CONFIRMATION_REQUIRED（BR-BILL-02）。
 */
public record BillPaymentRequest(
        @NotBlank(message = "Account ID must be supplied.")
        @Pattern(regexp = "\\d{11}", message = "Account ID must be 11 digits.")
        String accountId,
        Boolean confirm) {
}
