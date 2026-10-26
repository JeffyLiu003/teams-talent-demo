package com.carddemo.authorization.interfaces.rest.dto;

import com.carddemo.authorization.domain.model.AuthorizationCase;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 授权明细列表项（GET /api/v1/authorizations）。
 */
public record AuthorizationListItem(
        String authorizationId,
        String cardNumber,
        LocalDateTime authTimestamp,
        String transactionId,
        BigDecimal transactionAmount,
        String responseCode,
        String reasonCode,
        BigDecimal approvedAmount,
        String merchantName,
        String fraudFlag) {

    public static AuthorizationListItem from(AuthorizationCase authorization) {
        return new AuthorizationListItem(
                authorization.getAuthorizationId(),
                authorization.getCardNumber(),
                authorization.getAuthTimestamp(),
                authorization.getTransactionId(),
                authorization.getTransactionAmount(),
                authorization.getResponseCode(),
                authorization.getReasonCode(),
                authorization.getApprovedAmount(),
                authorization.getMerchantName(),
                authorization.getFraudFlag());
    }
}
