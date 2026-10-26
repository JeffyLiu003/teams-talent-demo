package com.carddemo.authorization.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * 卡级欺诈标记聚合。BR-AUTH-06：命中后该卡后续授权一律拒绝 5100。
 */
@Entity
@Table(name = "card_fraud_flag")
public class CardFraudFlag {

    @Id
    @Column(name = "card_number", length = 16, nullable = false, updatable = false)
    private String cardNumber;

    @Column(name = "flagged_at", nullable = false)
    private LocalDateTime flaggedAt;

    @Column(name = "reason", length = 100)
    private String reason;

    @Column(name = "authorization_id", length = 36)
    private String authorizationId;

    protected CardFraudFlag() {
        // for JPA
    }

    public CardFraudFlag(String cardNumber, LocalDateTime flaggedAt, String reason, String authorizationId) {
        this.cardNumber = cardNumber;
        this.flaggedAt = flaggedAt;
        this.reason = reason;
        this.authorizationId = authorizationId;
    }

    /**
     * 同一张卡重复标记时覆盖现有标记（对调用方幂等）。
     */
    public void reflag(LocalDateTime flaggedAt, String reason, String authorizationId) {
        this.flaggedAt = flaggedAt;
        this.reason = reason;
        this.authorizationId = authorizationId;
    }

    public String getCardNumber() {
        return cardNumber;
    }

    public LocalDateTime getFlaggedAt() {
        return flaggedAt;
    }

    public String getReason() {
        return reason;
    }

    public String getAuthorizationId() {
        return authorizationId;
    }
}
