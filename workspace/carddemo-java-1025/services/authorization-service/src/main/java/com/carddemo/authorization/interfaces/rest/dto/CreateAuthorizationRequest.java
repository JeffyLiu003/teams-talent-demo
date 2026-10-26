package com.carddemo.authorization.interfaces.rest.dto;

import com.carddemo.authorization.application.AuthorizationCommand;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 授权请求（POST /api/v1/authorizations）。除卡号与交易金额外均可选；authTimestamp 缺省为服务端当前时间。
 */
public record CreateAuthorizationRequest(
        @NotBlank(message = "Card Number must be supplied.")
        @Pattern(regexp = "\\d{16}", message = "Card Number must be 16 digits.")
        String cardNumber,

        @NotNull(message = "Transaction Amount must be supplied.")
        @DecimalMin(value = "0.00", inclusive = false, message = "Transaction Amount must be greater than zero.")
        @Digits(integer = 10, fraction = 2, message = "Transaction Amount must be 9999999999.99 format.")
        BigDecimal transactionAmount,

        @Size(max = 4, message = "Auth Type must be 4 characters.")
        String authType,

        @Pattern(regexp = "\\d{4}", message = "Card Expiry Date must be MMYY format.")
        String cardExpiryDate,

        @Size(max = 6, message = "Message Type must be 6 characters.")
        String messageType,

        @Size(max = 6, message = "Message Source must be 6 characters.")
        String messageSource,

        @Size(max = 6, message = "Processing Code must be 6 characters.")
        String processingCode,

        @Size(max = 4, message = "Merchant Category Code must be 4 characters.")
        String merchantCategoryCode,

        @Size(max = 3, message = "Acquirer Country Code must be 3 characters.")
        String acquirerCountryCode,

        Integer posEntryMode,

        @Size(max = 15, message = "Merchant ID must be 15 characters.")
        String merchantId,

        @Size(max = 22, message = "Merchant Name must be 22 characters.")
        String merchantName,

        @Size(max = 13, message = "Merchant City must be 13 characters.")
        String merchantCity,

        @Size(max = 2, message = "Merchant State must be 2 characters.")
        String merchantState,

        @Size(max = 9, message = "Merchant Zip Code must be 9 characters.")
        String merchantZip,

        @Size(max = 15, message = "Transaction ID must be 15 characters.")
        String transactionId,

        LocalDateTime authTimestamp) {

    public AuthorizationCommand toCommand() {
        return new AuthorizationCommand(cardNumber, transactionAmount, authType, cardExpiryDate, messageType,
                messageSource, processingCode, merchantCategoryCode, acquirerCountryCode, posEntryMode,
                merchantId, merchantName, merchantCity, merchantState, merchantZip, transactionId, authTimestamp);
    }
}
