package com.carddemo.authorization.interfaces.rest.dto;

import com.carddemo.authorization.domain.model.AuthorizationCase;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 授权明细响应（GET /api/v1/authorizations/{authorizationId}）：请求字段 + 决策 + 商户 + 归属。
 */
public record AuthorizationDetailResponse(
        String authorizationId,
        String cardNumber,
        LocalDateTime authTimestamp,
        String authType,
        String cardExpiryDate,
        String messageType,
        String messageSource,
        String authIdCode,
        String responseCode,
        String reasonCode,
        String processingCode,
        BigDecimal transactionAmount,
        BigDecimal approvedAmount,
        String merchantCategoryCode,
        String acquirerCountryCode,
        Integer posEntryMode,
        String merchantId,
        String merchantName,
        String merchantCity,
        String merchantState,
        String merchantZip,
        String transactionId,
        String fraudFlag,
        String accountId,
        String customerId,
        LocalDateTime createdAt) {

    public static AuthorizationDetailResponse from(AuthorizationCase authorization) {
        return new AuthorizationDetailResponse(
                authorization.getAuthorizationId(),
                authorization.getCardNumber(),
                authorization.getAuthTimestamp(),
                authorization.getAuthType(),
                authorization.getCardExpiryDate(),
                authorization.getMessageType(),
                authorization.getMessageSource(),
                authorization.getAuthIdCode(),
                authorization.getResponseCode(),
                authorization.getReasonCode(),
                authorization.getProcessingCode(),
                authorization.getTransactionAmount(),
                authorization.getApprovedAmount(),
                authorization.getMerchantCategoryCode(),
                authorization.getAcquirerCountryCode(),
                authorization.getPosEntryMode(),
                authorization.getMerchantId(),
                authorization.getMerchantName(),
                authorization.getMerchantCity(),
                authorization.getMerchantState(),
                authorization.getMerchantZip(),
                authorization.getTransactionId(),
                authorization.getFraudFlag(),
                authorization.getAccountId(),
                authorization.getCustomerId(),
                authorization.getCreatedAt());
    }
}
