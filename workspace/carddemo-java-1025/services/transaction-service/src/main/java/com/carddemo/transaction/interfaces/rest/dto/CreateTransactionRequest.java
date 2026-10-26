package com.carddemo.transaction.interfaces.rest.dto;

import com.carddemo.transaction.application.CreateTransactionCommand;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 交易录入请求。BR-TRN-01/03/04/05/06：账户号或卡号至少一个；类型/类别/商户号为数字；
 * 金额最多 2 位小数；原始/处理日期为必填 YYYY-MM-DD。
 */
public record CreateTransactionRequest(
        @Size(max = 11, message = "Account ID must be 11 characters.")
        String accountId,

        @Size(max = 16, message = "Card Number must be 16 characters.")
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

        @NotNull(message = "Original Date must be supplied.")
        LocalDate originalDate,

        @NotNull(message = "Processed Date must be supplied.")
        LocalDate processedDate,

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

    public CreateTransactionCommand toCommand() {
        return new CreateTransactionCommand(accountId, cardNumber, typeCode, categoryCode, source, description,
                amount, originalDate, processedDate, merchantId, merchantName, merchantCity, merchantZip);
    }
}
