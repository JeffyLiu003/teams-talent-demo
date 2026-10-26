package com.carddemo.marketing.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;

import java.time.LocalDateTime;

/**
 * 报名记录：同一活动同一卡号唯一（MK-ENR-01）。
 */
@Entity
@Table(name = "enrollment",
        uniqueConstraints = @UniqueConstraint(name = "uk_enrollment_campaign_card",
                columnNames = {"campaign_id", "card_number"}))
public class Enrollment {

    @Id
    @Column(name = "enrollment_id", length = 36, nullable = false, updatable = false)
    private String enrollmentId;

    @Column(name = "campaign_id", length = 36, nullable = false)
    private String campaignId;

    @Column(name = "card_number", length = 16, nullable = false)
    private String cardNumber;

    @Column(name = "account_id", length = 11, nullable = false)
    private String accountId;

    @Column(name = "customer_id", length = 9)
    private String customerId;

    @Column(name = "enrolled_at", nullable = false)
    private LocalDateTime enrolledAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected Enrollment() {
        // for JPA
    }

    public Enrollment(String enrollmentId, String campaignId, String cardNumber, String accountId,
                      String customerId, LocalDateTime enrolledAt) {
        this.enrollmentId = enrollmentId;
        this.campaignId = campaignId;
        this.cardNumber = cardNumber;
        this.accountId = accountId;
        this.customerId = customerId;
        this.enrolledAt = enrolledAt;
    }

    public String getEnrollmentId() {
        return enrollmentId;
    }

    public String getCampaignId() {
        return campaignId;
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

    public LocalDateTime getEnrolledAt() {
        return enrolledAt;
    }

    public long getVersion() {
        return version;
    }
}
