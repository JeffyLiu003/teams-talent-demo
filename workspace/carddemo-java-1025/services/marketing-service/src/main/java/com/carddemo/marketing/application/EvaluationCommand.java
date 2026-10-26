package com.carddemo.marketing.application;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record EvaluationCommand(
        String transactionId,
        String cardNumber,
        String accountId,
        String customerId,
        BigDecimal amount,
        String categoryCode,
        String typeCode,
        String description,
        LocalDateTime processedAt) {
}
