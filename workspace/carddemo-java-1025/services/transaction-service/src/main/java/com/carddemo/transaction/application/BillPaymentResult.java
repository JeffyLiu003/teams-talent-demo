package com.carddemo.transaction.application;

import java.math.BigDecimal;

public record BillPaymentResult(String transactionId, BigDecimal amount, BigDecimal newBalance) {
}
