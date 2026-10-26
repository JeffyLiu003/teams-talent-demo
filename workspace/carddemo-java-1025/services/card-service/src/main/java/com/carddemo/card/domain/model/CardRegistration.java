package com.carddemo.card.domain.model;

import java.time.LocalDate;

/**
 * 新卡注册字段集合，对应遗留 CCXREF 中"新增卡片"所需的 CARD + CARDXREF 字段。
 */
public record CardRegistration(
        String cardNumber,
        String accountId,
        String customerId,
        String cvv,
        String embossedName,
        LocalDate expirationDate,
        String activeStatus) {
}
