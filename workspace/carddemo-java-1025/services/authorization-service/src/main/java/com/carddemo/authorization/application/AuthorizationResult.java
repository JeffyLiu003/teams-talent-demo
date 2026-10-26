package com.carddemo.authorization.application;

import com.carddemo.authorization.domain.model.AuthorizationCase;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 授权决策结果（POST /api/v1/authorizations 响应）。
 * 卡号不存在时的拒绝不落库，authTimestamp 仍回显请求值。
 */
public record AuthorizationResult(
        String authorizationId,
        String cardNumber,
        String transactionId,
        LocalDateTime authTimestamp,
        String responseCode,
        String reasonCode,
        BigDecimal approvedAmount,
        String accountId,
        String customerId,
        String fraudFlag) {

    public static AuthorizationResult from(AuthorizationCase authorization) {
        return new AuthorizationResult(
                authorization.getAuthorizationId(),
                authorization.getCardNumber(),
                authorization.getTransactionId(),
                authorization.getAuthTimestamp(),
                authorization.getResponseCode(),
                authorization.getReasonCode(),
                authorization.getApprovedAmount(),
                authorization.getAccountId(),
                authorization.getCustomerId(),
                authorization.getFraudFlag());
    }
}
