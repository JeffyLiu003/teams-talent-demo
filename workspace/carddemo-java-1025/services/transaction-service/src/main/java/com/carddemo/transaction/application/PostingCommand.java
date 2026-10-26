package com.carddemo.transaction.application;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 单笔入账命令（原 DALYTRAN 记录）。transactionId 为空时由服务端生成（max + 1）。
 */
public record PostingCommand(
        String transactionId,
        String cardNumber,
        String typeCode,
        String categoryCode,
        String source,
        String description,
        BigDecimal amount,
        LocalDateTime originalTimestamp,
        String merchantId,
        String merchantName,
        String merchantCity,
        String merchantZip) {
}
