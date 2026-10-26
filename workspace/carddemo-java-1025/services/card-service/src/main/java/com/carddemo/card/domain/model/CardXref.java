package com.carddemo.card.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.Objects;

/**
 * 卡号 → 账户/客户交叉引用，对应遗留 VSAM 文件 CARDXREF（copybook CVACT03Y）。
 * 与 {@link Card} 一一对应，同一事务内写入（BR-CARD-01）。
 */
@Entity
@Table(name = "card_xref")
public class CardXref {

    @Id
    @Column(name = "card_number", length = 16, nullable = false, updatable = false)
    private String cardNumber;

    @Column(name = "customer_id", length = 9, nullable = false)
    private String customerId;

    @Column(name = "account_id", length = 11, nullable = false)
    private String accountId;

    protected CardXref() {
        // for JPA
    }

    public CardXref(String cardNumber, String customerId, String accountId) {
        this.cardNumber = Objects.requireNonNull(cardNumber, "cardNumber must not be null");
        this.customerId = Objects.requireNonNull(customerId, "customerId must not be null");
        this.accountId = Objects.requireNonNull(accountId, "accountId must not be null");
    }

    public String getCardNumber() {
        return cardNumber;
    }

    public String getCustomerId() {
        return customerId;
    }

    public String getAccountId() {
        return accountId;
    }
}
