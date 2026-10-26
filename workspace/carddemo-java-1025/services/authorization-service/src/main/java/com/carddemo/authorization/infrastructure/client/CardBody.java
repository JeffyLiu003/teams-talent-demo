package com.carddemo.authorization.infrastructure.client;

import com.carddemo.authorization.domain.model.CardSnapshot;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.LocalDate;

/**
 * card-service 的 CardResponse 投影（不返回 CVV，见 NR-CARD-02）。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
record CardBody(
        String cardNumber,
        String accountId,
        String customerId,
        LocalDate expiryDate,
        String activeStatus) {

    CardSnapshot toSnapshot() {
        return new CardSnapshot(cardNumber, accountId, customerId, activeStatus, expiryDate);
    }
}
