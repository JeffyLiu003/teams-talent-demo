package com.carddemo.authorization.application;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 授权请求命令（POST /api/v1/authorizations）。除 cardNumber、transactionAmount 外均可选；
 * authTimestamp 缺省为服务端当前时间。
 */
public record AuthorizationCommand(
        String cardNumber,
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
        LocalDateTime authTimestamp) {
}
