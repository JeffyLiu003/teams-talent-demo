package com.carddemo.transaction.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.util.Objects;

/**
 * 交易类别累计（TCATBALF / CVTRA01Y）。计息基数，也是入账时需要累加的净额（BR-POST-06、BR-INT-01）。
 */
@Entity
@Table(name = "tran_category_balance")
public class TranCategoryBalance {

    private static final BigDecimal ZERO = new BigDecimal("0.00");

    @EmbeddedId
    private TranCategoryBalanceId id;

    @Column(name = "balance", nullable = false, precision = 12, scale = 2)
    private BigDecimal balance;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected TranCategoryBalance() {
        // for JPA
    }

    public TranCategoryBalance(String accountId, String typeCode, String categoryCode, BigDecimal balance) {
        this.id = new TranCategoryBalanceId(accountId, typeCode, categoryCode);
        this.balance = balance == null ? ZERO : balance;
    }

    /**
     * 累加类别余额（入账通过后调用）。
     */
    public void apply(BigDecimal amount) {
        Objects.requireNonNull(amount, "amount must not be null");
        this.balance = this.balance.add(amount);
    }

    public String getAccountId() {
        return id.getAccountId();
    }

    public String getTypeCode() {
        return id.getTypeCode();
    }

    public String getCategoryCode() {
        return id.getCategoryCode();
    }

    public TranCategoryBalanceId getId() {
        return id;
    }

    public BigDecimal getBalance() {
        return balance;
    }

    public long getVersion() {
        return version;
    }
}
