package com.carddemo.authorization.domain.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 授权请求快照（写入 auth_detail 的请求字段，已解析出账户号与客户号）。
 * 字段与遗留 AUTHFRDS 记录一一对应（docs/legacy/04-data-dictionary.md）。
 */
public record AuthorizationRequest(
        String cardNumber,
        LocalDateTime authTimestamp,
        BigDecimal transactionAmount,
        String authType,
        String cardExpiryDate,
        String messageType,
        String messageSource,
        String processingCode,
        String merchantCategoryCode,
        String acquirerCountryCode,
        Integer posEntryMode,
        String merchantId,
        String merchantName,
        String merchantCity,
        String merchantState,
        String merchantZip,
        String transactionId,
        String accountId,
        String customerId) {
}
