package com.carddemo.card.interfaces.rest.dto;

import com.carddemo.card.domain.model.Card;

import java.time.LocalDate;

/**
 * 卡片响应。NR-CARD-02：不得返回 CVV。
 */
public record CardResponse(
        String cardNumber,
        String accountId,
        String customerId,
        String embossedName,
        LocalDate expiryDate,
        String activeStatus,
        long version) {

    public static CardResponse from(Card card) {
        return new CardResponse(
                card.getCardNumber(),
                card.getAccountId(),
                card.getCustomerId(),
                card.getEmbossedName(),
                card.getExpirationDate(),
                card.getActiveStatus(),
                card.getVersion());
    }
}
