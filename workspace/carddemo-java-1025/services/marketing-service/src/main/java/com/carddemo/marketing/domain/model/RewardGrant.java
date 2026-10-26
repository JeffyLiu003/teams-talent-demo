package com.carddemo.marketing.domain.model;

import com.carddemo.marketing.domain.exception.BusinessRuleException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 奖励发放记录。同一活动同一交易唯一（MK-REW-01 幂等）。
 */
@Entity
@Table(name = "reward_grant",
        uniqueConstraints = @UniqueConstraint(name = "uk_reward_campaign_txn",
                columnNames = {"campaign_id", "transaction_id"}))
public class RewardGrant {

    @Id
    @Column(name = "reward_id", length = 36, nullable = false, updatable = false)
    private String rewardId;

    @Column(name = "campaign_id", length = 36, nullable = false)
    private String campaignId;

    @Column(name = "transaction_id", length = 16, nullable = false)
    private String transactionId;

    @Column(name = "card_number", length = 16, nullable = false)
    private String cardNumber;

    @Column(name = "account_id", length = 11, nullable = false)
    private String accountId;

    @Column(name = "customer_id", length = 9)
    private String customerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "reward_type", length = 16, nullable = false)
    private RewardType rewardType;

    @Column(name = "reward_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal rewardAmount;

    @Column(name = "reward_points", nullable = false)
    private int rewardPoints;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 16, nullable = false)
    private RewardStatus status;

    @Column(name = "failure_reason", length = 200)
    private String failureReason;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "granted_at")
    private LocalDateTime grantedAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected RewardGrant() {
        // for JPA
    }

    public RewardGrant(String rewardId, String campaignId, String transactionId, String cardNumber,
                       String accountId, String customerId, RewardComputation computation,
                       LocalDateTime createdAt) {
        if (computation.amount().signum() <= 0 && computation.points() <= 0) {
            throw new BusinessRuleException("REWARD_ZERO", "Computed reward must be greater than zero.");
        }
        this.rewardId = rewardId;
        this.campaignId = campaignId;
        this.transactionId = transactionId;
        this.cardNumber = cardNumber;
        this.accountId = accountId;
        this.customerId = customerId;
        this.rewardType = computation.rewardType();
        this.rewardAmount = computation.rewardType() == RewardType.CASHBACK
                ? computation.amount() : BigDecimal.ZERO.setScale(2);
        this.rewardPoints = computation.points();
        this.status = RewardStatus.PENDING;
        this.createdAt = createdAt;
    }

    public void markGranted(LocalDateTime now) {
        this.status = RewardStatus.GRANTED;
        this.grantedAt = now;
        this.failureReason = null;
    }

    public void markPending(String reason) {
        this.status = RewardStatus.PENDING;
        this.failureReason = reason;
    }

    public void markFailed(String reason) {
        this.status = RewardStatus.FAILED;
        this.failureReason = reason;
    }

    public boolean isGranted() {
        return status == RewardStatus.GRANTED;
    }

    public boolean isCashback() {
        return rewardType == RewardType.CASHBACK;
    }

    public String getRewardId() {
        return rewardId;
    }

    public String getCampaignId() {
        return campaignId;
    }

    public String getTransactionId() {
        return transactionId;
    }

    public String getCardNumber() {
        return cardNumber;
    }

    public String getAccountId() {
        return accountId;
    }

    public String getCustomerId() {
        return customerId;
    }

    public RewardType getRewardType() {
        return rewardType;
    }

    public BigDecimal getRewardAmount() {
        return rewardAmount;
    }

    public int getRewardPoints() {
        return rewardPoints;
    }

    public RewardStatus getStatus() {
        return status;
    }

    public String getFailureReason() {
        return failureReason;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getGrantedAt() {
        return grantedAt;
    }

    public long getVersion() {
        return version;
    }
}
