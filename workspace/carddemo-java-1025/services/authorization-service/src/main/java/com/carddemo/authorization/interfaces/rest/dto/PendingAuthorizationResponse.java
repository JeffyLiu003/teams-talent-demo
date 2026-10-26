package com.carddemo.authorization.interfaces.rest.dto;

import com.carddemo.authorization.domain.model.AuthorizationSummary;

import java.math.BigDecimal;

/**
 * 待授权汇总响应（GET /api/v1/pending-authorizations/{accountId}）。
 */
public record PendingAuthorizationResponse(
        String accountId,
        BigDecimal creditLimit,
        BigDecimal cashLimit,
        BigDecimal creditBalance,
        BigDecimal cashBalance,
        int approvedCount,
        BigDecimal approvedAmount,
        int declinedCount,
        BigDecimal declinedAmount) {

    public static PendingAuthorizationResponse from(AuthorizationSummary summary) {
        return new PendingAuthorizationResponse(
                summary.getAccountId(),
                summary.getCreditLimit(),
                summary.getCashLimit(),
                summary.getCreditBalance(),
                summary.getCashBalance(),
                summary.getApprovedCount(),
                summary.getApprovedAmount(),
                summary.getDeclinedCount(),
                summary.getDeclinedAmount());
    }
}
