package com.carddemo.transaction.interfaces.rest.dto;

import com.carddemo.transaction.application.BillPaymentResult;

import java.math.BigDecimal;

public record BillPaymentResponse(String transactionId, BigDecimal amount, BigDecimal newBalance) {

    public static BillPaymentResponse from(BillPaymentResult result) {
        return new BillPaymentResponse(result.transactionId(), result.amount(), result.newBalance());
    }
}
