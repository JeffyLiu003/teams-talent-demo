package com.carddemo.authorization.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.util.Objects;

/**
 * 待授权汇总聚合根。对应遗留 IMS PAUTSUM0（每账户一条，占用可用额度）。
 * BR-AUTH-10：批准 → 笔数+1、金额+、信用余额+；拒绝 → 笔数+1、金额+。
 */
@Entity
@Table(name = "auth_summary")
public class AuthorizationSummary {

    private static final BigDecimal ZERO = new BigDecimal("0.00");

    @Id
    @Column(name = "account_id", length = 11, nullable = false, updatable = false)
    private String accountId;

    @Column(name = "credit_limit", nullable = false, precision = 12, scale = 2)
    private BigDecimal creditLimit;

    @Column(name = "cash_limit", nullable = false, precision = 12, scale = 2)
    private BigDecimal cashLimit;

    @Column(name = "credit_balance", nullable = false, precision = 12, scale = 2)
    private BigDecimal creditBalance;

    @Column(name = "cash_balance", nullable = false, precision = 12, scale = 2)
    private BigDecimal cashBalance;

    @Column(name = "approved_count", nullable = false)
    private int approvedCount;

    @Column(name = "approved_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal approvedAmount;

    @Column(name = "declined_count", nullable = false)
    private int declinedCount;

    @Column(name = "declined_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal declinedAmount;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected AuthorizationSummary() {
        // for JPA
    }

    /**
     * 首次授权时以账户额度初始化汇总，余额与计数为 0。
     */
    public AuthorizationSummary(String accountId, BigDecimal creditLimit, BigDecimal cashLimit) {
        this.accountId = accountId;
        this.creditLimit = creditLimit;
        this.cashLimit = cashLimit;
        this.creditBalance = ZERO;
        this.cashBalance = ZERO;
        this.approvedAmount = ZERO;
        this.declinedAmount = ZERO;
        this.version = 0;
    }

    public void applyApproved(BigDecimal amount) {
        Objects.requireNonNull(amount, "amount must not be null");
        approvedCount += 1;
        approvedAmount = approvedAmount.add(amount);
        creditBalance = creditBalance.add(amount);
    }

    public void applyDeclined(BigDecimal amount) {
        Objects.requireNonNull(amount, "amount must not be null");
        declinedCount += 1;
        declinedAmount = declinedAmount.add(amount);
    }

    /**
     * NR-AUTH-01/02：过期清理后按剩余明细重算（信用余额 = 剩余批准金额之和）。
     */
    public void recalculateFromDetails(int approvedCount, BigDecimal approvedAmount,
                                       int declinedCount, BigDecimal declinedAmount,
                                       BigDecimal creditBalance) {
        this.approvedCount = approvedCount;
        this.approvedAmount = approvedAmount;
        this.declinedCount = declinedCount;
        this.declinedAmount = declinedAmount;
        this.creditBalance = creditBalance;
    }

    public boolean isEmpty() {
        return approvedCount == 0 && declinedCount == 0;
    }

    public String getAccountId() {
        return accountId;
    }

    public BigDecimal getCreditLimit() {
        return creditLimit;
    }

    public BigDecimal getCashLimit() {
        return cashLimit;
    }

    public BigDecimal getCreditBalance() {
        return creditBalance;
    }

    public BigDecimal getCashBalance() {
        return cashBalance;
    }

    public int getApprovedCount() {
        return approvedCount;
    }

    public BigDecimal getApprovedAmount() {
        return approvedAmount;
    }

    public int getDeclinedCount() {
        return declinedCount;
    }

    public BigDecimal getDeclinedAmount() {
        return declinedAmount;
    }

    public long getVersion() {
        return version;
    }
}
