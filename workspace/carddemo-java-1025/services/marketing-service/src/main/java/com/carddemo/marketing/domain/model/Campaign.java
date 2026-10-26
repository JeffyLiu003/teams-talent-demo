package com.carddemo.marketing.domain.model;

import com.carddemo.marketing.domain.exception.BusinessRuleException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Objects;

/**
 * 营销活动聚合根。状态机：DRAFT → ACTIVE ⇄ PAUSED → ENDED。
 * 规则详见 docs/design/08-marketing-capability.md。
 */
@Entity
@Table(name = "campaign")
public class Campaign {

    private static final BigDecimal ZERO = new BigDecimal("0.00");

    @Id
    @Column(name = "campaign_id", length = 36, nullable = false, updatable = false)
    private String campaignId;

    @Column(name = "name", length = 80, nullable = false)
    private String name;

    @Column(name = "description", length = 300)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "campaign_type", length = 32, nullable = false)
    private CampaignType campaignType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 16, nullable = false)
    private CampaignStatus status;

    @Column(name = "start_at", nullable = false)
    private LocalDateTime startAt;

    @Column(name = "end_at", nullable = false)
    private LocalDateTime endAt;

    @Column(name = "target_group_id", length = 10)
    private String targetGroupId;

    @Column(name = "category_code", length = 4)
    private String categoryCode;

    @Column(name = "min_transaction_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal minTransactionAmount = ZERO;

    @Column(name = "reward_rate", precision = 6, scale = 4)
    private BigDecimal rewardRate;

    @Column(name = "fixed_reward_amount", precision = 12, scale = 2)
    private BigDecimal fixedRewardAmount;

    @Column(name = "max_reward_per_transaction", precision = 12, scale = 2)
    private BigDecimal maxRewardPerTransaction;

    @Column(name = "max_rewards_per_card")
    private Integer maxRewardsPerCard;

    @Column(name = "budget", nullable = false, precision = 12, scale = 2)
    private BigDecimal budget = ZERO;

    @Column(name = "consumed_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal consumedAmount = ZERO;

    @Column(name = "points_multiplier", precision = 5, scale = 2)
    private BigDecimal pointsMultiplier;

    @Column(name = "enrollment_required", nullable = false)
    private boolean enrollmentRequired;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected Campaign() {
        // for JPA
    }

    public Campaign(String campaignId, CampaignDraft draft, LocalDateTime now) {
        this.campaignId = campaignId;
        this.status = CampaignStatus.DRAFT;
        this.consumedAmount = ZERO;
        this.createdAt = now;
        this.updatedAt = now;
        applyDraft(draft, now);
    }

    /**
     * MK-CAM-01..06：只有 DRAFT 可编辑规则。
     */
    public void applyDraft(CampaignDraft draft, LocalDateTime now) {
        if (status != CampaignStatus.DRAFT) {
            throw new BusinessRuleException("CAMPAIGN_NOT_EDITABLE", "Only DRAFT campaigns can be edited.");
        }
        validate(draft);
        this.name = draft.name().trim();
        this.description = draft.description() == null ? null : draft.description().trim();
        this.campaignType = draft.campaignType();
        this.startAt = draft.startAt();
        this.endAt = draft.endAt();
        this.targetGroupId = blankToNull(draft.targetGroupId());
        this.categoryCode = blankToNull(draft.categoryCode());
        this.minTransactionAmount = draft.minTransactionAmount() == null ? ZERO : draft.minTransactionAmount();
        this.rewardRate = draft.rewardRate();
        this.fixedRewardAmount = draft.fixedRewardAmount();
        this.maxRewardPerTransaction = draft.maxRewardPerTransaction();
        this.maxRewardsPerCard = draft.maxRewardsPerCard();
        this.budget = draft.budget() == null ? ZERO : draft.budget();
        this.pointsMultiplier = draft.pointsMultiplier();
        this.enrollmentRequired = draft.enrollmentRequired();
        this.updatedAt = now;
    }

    public void activate(LocalDateTime now) {
        if (status != CampaignStatus.DRAFT && status != CampaignStatus.PAUSED) {
            throw new BusinessRuleException("INVALID_CAMPAIGN_STATE",
                    "Only DRAFT or PAUSED campaigns can be activated.");
        }
        if (!now.isBefore(endAt)) {
            throw new BusinessRuleException("CAMPAIGN_EXPIRED", "Campaign end time has passed.");
        }
        if (campaignType == CampaignType.CATEGORY_CASHBACK && budget.signum() <= 0) {
            throw new BusinessRuleException("BUDGET_REQUIRED", "Cashback campaign requires a positive budget.");
        }
        this.status = CampaignStatus.ACTIVE;
        this.updatedAt = now;
    }

    public void pause(LocalDateTime now) {
        if (status != CampaignStatus.ACTIVE) {
            throw new BusinessRuleException("INVALID_CAMPAIGN_STATE", "Only ACTIVE campaigns can be paused.");
        }
        this.status = CampaignStatus.PAUSED;
        this.updatedAt = now;
    }

    public void end(LocalDateTime now) {
        if (status != CampaignStatus.ACTIVE && status != CampaignStatus.PAUSED) {
            throw new BusinessRuleException("INVALID_CAMPAIGN_STATE",
                    "Only ACTIVE or PAUSED campaigns can be ended.");
        }
        this.status = CampaignStatus.ENDED;
        this.updatedAt = now;
    }

    public boolean isActiveAt(LocalDateTime moment) {
        return status == CampaignStatus.ACTIVE
                && !moment.isBefore(startAt)
                && moment.isBefore(endAt);
    }

    public boolean isCashback() {
        return campaignType != CampaignType.POINTS_MULTIPLIER;
    }

    public boolean matchesGroup(String accountGroupId) {
        return targetGroupId == null || Objects.equals(targetGroupId, accountGroupId);
    }

    public boolean matchesCategory(String transactionCategory) {
        return categoryCode == null || Objects.equals(categoryCode, transactionCategory);
    }

    /**
     * MK-ELI-09：现金返现预算是否足够。
     */
    public boolean hasBudgetFor(BigDecimal rewardAmount) {
        if (!isCashback()) {
            return true;
        }
        if (budget.signum() <= 0) {
            return true;
        }
        return consumedAmount.add(rewardAmount).compareTo(budget) <= 0;
    }

    public void consumeCashback(BigDecimal rewardAmount) {
        if (!isCashback()) {
            return;
        }
        if (!hasBudgetFor(rewardAmount)) {
            throw new BusinessRuleException("BUDGET_EXHAUSTED", "Campaign budget is exhausted.");
        }
        this.consumedAmount = consumedAmount.add(rewardAmount);
        this.updatedAt = LocalDateTime.now();
    }

    public BigDecimal remainingBudget() {
        if (budget.signum() <= 0) {
            return null;
        }
        return budget.subtract(consumedAmount).max(ZERO);
    }

    private static void validate(CampaignDraft draft) {
        if (draft.name() == null || draft.name().isBlank()) {
            throw new BusinessRuleException("INVALID_CAMPAIGN", "Campaign name must be supplied.");
        }
        if (draft.name().trim().length() > 80) {
            throw new BusinessRuleException("INVALID_CAMPAIGN", "Campaign name must be 80 characters or less.");
        }
        if (draft.campaignType() == null) {
            throw new BusinessRuleException("INVALID_CAMPAIGN_TYPE", "Campaign type must be supplied.");
        }
        if (draft.startAt() == null || draft.endAt() == null) {
            throw new BusinessRuleException("INVALID_CAMPAIGN_PERIOD", "Campaign start and end time must be supplied.");
        }
        if (!draft.startAt().isBefore(draft.endAt())) {
            throw new BusinessRuleException("INVALID_CAMPAIGN_PERIOD", "Campaign start time must be before end time.");
        }
        if (draft.minTransactionAmount() != null && draft.minTransactionAmount().signum() < 0) {
            throw new BusinessRuleException("INVALID_CAMPAIGN_RULE", "Minimum transaction amount must not be negative.");
        }
        if (draft.maxRewardsPerCard() != null && draft.maxRewardsPerCard() <= 0) {
            throw new BusinessRuleException("INVALID_CAMPAIGN_RULE", "Max rewards per card must be greater than zero.");
        }
        if (draft.budget() != null && draft.budget().signum() < 0) {
            throw new BusinessRuleException("INVALID_CAMPAIGN_RULE", "Budget must not be negative.");
        }
        if (draft.categoryCode() != null && !draft.categoryCode().isBlank()
                && !draft.categoryCode().trim().matches("\\d{4}")) {
            throw new BusinessRuleException("INVALID_CAMPAIGN_RULE", "Category code must be 4 digits.");
        }
        switch (draft.campaignType()) {
            case FIRST_PURCHASE_CASHBACK -> {
                if (draft.fixedRewardAmount() == null || draft.fixedRewardAmount().signum() <= 0) {
                    throw new BusinessRuleException("INVALID_CAMPAIGN_RULE",
                            "First purchase campaign requires a positive fixed reward amount.");
                }
            }
            case CATEGORY_CASHBACK -> {
                boolean hasRate = draft.rewardRate() != null && draft.rewardRate().signum() > 0;
                boolean hasFixed = draft.fixedRewardAmount() != null && draft.fixedRewardAmount().signum() > 0;
                if (!hasRate && !hasFixed) {
                    throw new BusinessRuleException("INVALID_CAMPAIGN_RULE",
                            "Category cashback requires a reward rate or fixed reward amount.");
                }
                if (hasRate && draft.rewardRate().compareTo(BigDecimal.ONE) > 0) {
                    throw new BusinessRuleException("INVALID_CAMPAIGN_RULE", "Reward rate must not exceed 100%.");
                }
                if (draft.budget() == null || draft.budget().signum() <= 0) {
                    throw new BusinessRuleException("BUDGET_REQUIRED", "Cashback campaign requires a positive budget.");
                }
            }
            case POINTS_MULTIPLIER -> {
                if (draft.pointsMultiplier() == null || draft.pointsMultiplier().signum() <= 0) {
                    throw new BusinessRuleException("INVALID_CAMPAIGN_RULE",
                            "Points campaign requires a positive multiplier.");
                }
            }
            default -> throw new BusinessRuleException("INVALID_CAMPAIGN_TYPE", "Unsupported campaign type.");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public String getCampaignId() {
        return campaignId;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public CampaignType getCampaignType() {
        return campaignType;
    }

    public CampaignStatus getStatus() {
        return status;
    }

    public LocalDateTime getStartAt() {
        return startAt;
    }

    public LocalDateTime getEndAt() {
        return endAt;
    }

    public String getTargetGroupId() {
        return targetGroupId;
    }

    public String getCategoryCode() {
        return categoryCode;
    }

    public BigDecimal getMinTransactionAmount() {
        return minTransactionAmount;
    }

    public BigDecimal getRewardRate() {
        return rewardRate;
    }

    public BigDecimal getFixedRewardAmount() {
        return fixedRewardAmount;
    }

    public BigDecimal getMaxRewardPerTransaction() {
        return maxRewardPerTransaction;
    }

    public Integer getMaxRewardsPerCard() {
        return maxRewardsPerCard;
    }

    public BigDecimal getBudget() {
        return budget;
    }

    public BigDecimal getConsumedAmount() {
        return consumedAmount;
    }

    public BigDecimal getPointsMultiplier() {
        return pointsMultiplier;
    }

    public boolean isEnrollmentRequired() {
        return enrollmentRequired;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public long getVersion() {
        return version;
    }
}
