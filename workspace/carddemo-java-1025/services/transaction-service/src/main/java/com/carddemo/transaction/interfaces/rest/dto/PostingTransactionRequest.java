package com.carddemo.transaction.interfaces.rest.dto;

import com.carddemo.transaction.application.PostingCommand;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 单笔入账请求（原 DALYTRAN 记录）。transactionId 可省略，省略时由服务端生成。
 */
public record PostingTransactionRequest(
        @Size(max = 16, message = "Transaction ID must be 16 characters.")
        String transactionId,

        @NotBlank(message = "Card Number must be supplied.")
        @Pattern(regexp = "\\d{16}", message = "Card Number must be 16 digits.")
        String cardNumber,

        @NotBlank(message = "Transaction Type must be supplied.")
        @Pattern(regexp = "\\d{2}", message = "Transaction Type must be numeric.")
        String typeCode,

        @NotBlank(message = "Transaction Category must be supplied.")
        @Pattern(regexp = "\\d{4}", message = "Transaction Category must be numeric.")
        String categoryCode,

        @NotBlank(message = "Transaction Source must be supplied.")
        @Size(max = 10, message = "Transaction Source must be 10 characters.")
        String source,

        @NotBlank(message = "Transaction Description must be supplied.")
        @Size(max = 100, message = "Transaction Description must be 100 characters.")
        String description,

        @NotNull(message = "Transaction Amount must be supplied.")
        @Digits(integer = 8, fraction = 2, message = "Transaction Amount must be -99999999.99 format.")
        BigDecimal amount,

        @NotNull(message = "Original Timestamp must be supplied.")
        LocalDateTime originalTimestamp,

        @NotBlank(message = "Merchant ID must be supplied.")
        @Pattern(regexp = "\\d{9}", message = "Merchant ID must be numeric.")
        String merchantId,

        @NotBlank(message = "Merchant Name must be supplied.")
        @Size(max = 50, message = "Merchant Name must be 50 characters.")
        String merchantName,

        @NotBlank(message = "Merchant City must be supplied.")
        @Size(max = 50, message = "Merchant City must be 50 characters.")
        String merchantCity,

        @NotBlank(message = "Merchant Zip Code must be supplied.")
        @Size(max = 10, message = "Merchant Zip Code must be 10 characters.")
        String merchantZip) {

    public PostingCommand toCommand() {
        return new PostingCommand(transactionId, cardNumber, typeCode, categoryCode, source, description,
                amount, originalTimestamp, merchantId, merchantName, merchantCity, merchantZip);
    }
}
