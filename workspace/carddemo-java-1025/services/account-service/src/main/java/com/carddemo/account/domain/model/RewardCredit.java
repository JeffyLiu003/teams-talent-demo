package com.carddemo.account.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 返现入账幂等记录：同一 rewardId 只允许入账一次（NR-REWARD-01）。
 */
@Entity
@Table(name = "reward_credit")
public class RewardCredit {

    @Id
    @Column(name = "reward_id", length = 36, nullable = false, updatable = false)
    private String rewardId;

    @Column(name = "account_id", length = 11, nullable = false)
    private String accountId;

    @Column(name = "campaign_id", length = 36, nullable = false)
    private String campaignId;

    @Column(name = "amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    protected RewardCredit() {
        // for JPA
    }

    public RewardCredit(String rewardId, String accountId, String campaignId, BigDecimal amount,
                        LocalDateTime createdAt) {
        this.rewardId = rewardId;
        this.accountId = accountId;
        this.campaignId = campaignId;
        this.amount = amount;
        this.createdAt = createdAt;
    }

    public String getRewardId() {
        return rewardId;
    }

    public String getAccountId() {
        return accountId;
    }

    public String getCampaignId() {
        return campaignId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
