package com.carddemo.transaction.application;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 交易录入命令（COTRN02C）。
 */
public record CreateTransactionCommand(
        String accountId,
        String cardNumber,
        String typeCode,
        String categoryCode,
        String source,
        String description,
        BigDecimal amount,
        LocalDate originalDate,
        LocalDate processedDate,
        String merchantId,
        String merchantName,
        String merchantCity,
        String merchantZip) {
}
