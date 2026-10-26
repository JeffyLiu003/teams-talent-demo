package com.carddemo.card.domain.model;

import com.carddemo.card.domain.exception.BusinessRuleException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * 卡片聚合根。对应遗留 VSAM 文件 CARDDATA，记录布局见 copybook CVACT02Y（RECLN 150）。
 */
@Entity
@Table(name = "card")
public class Card {

    private static final String VALIDATION_FAILED = "VALIDATION_FAILED";
    private static final Pattern CARD_NUMBER = Pattern.compile("\\d{16}");
    private static final Pattern ACCOUNT_ID = Pattern.compile("\\d{11}");
    private static final Pattern CUSTOMER_ID = Pattern.compile("\\d{9}");
    private static final Pattern CVV = Pattern.compile("\\d{3}");
    private static final Pattern EMBOSSED_NAME = Pattern.compile("[A-Za-z]+(?: [A-Za-z]+)*");

    @Id
    @Column(name = "card_number", length = 16, nullable = false, updatable = false)
    private String cardNumber;

    @Column(name = "account_id", length = 11, nullable = false, updatable = false)
    private String accountId;

    @Column(name = "customer_id", length = 9, nullable = false, updatable = false)
    private String customerId;

    @Column(name = "cvv", length = 3, nullable = false, updatable = false)
    private String cvv;

    @Column(name = "embossed_name", length = 50, nullable = false)
    private String embossedName;

    @Column(name = "expiration_date", nullable = false)
    private LocalDate expirationDate;

    @Column(name = "active_status", length = 1, nullable = false)
    private String activeStatus;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected Card() {
        // for JPA
    }

    public Card(CardRegistration registration) {
        Objects.requireNonNull(registration, "registration must not be null");
        this.cardNumber = requireIdentifier(registration.cardNumber(), CARD_NUMBER, 16, "Card Number");
        this.accountId = requireIdentifier(registration.accountId(), ACCOUNT_ID, 11, "Account ID");
        this.customerId = requireIdentifier(registration.customerId(), CUSTOMER_ID, 9, "Customer ID");
        this.cvv = requireCvv(registration.cvv());
        this.embossedName = requireEmbossedName(registration.embossedName());
        this.expirationDate = requireExpirationDate(registration.expirationDate());
        this.activeStatus = requireActiveStatus(registration.activeStatus());
        this.version = 0;
    }

    /**
     * BR-CARD-07/08/09 + NR-CARD-01：卡片维护只改卡面名、状态与到期月/年。
     * 到期日保留原日，该月不存在该日时取该月最后一天；CVV 一律不改写。
     */
    public void applyMaintenance(String embossedName, String activeStatus, int expiryMonth, int expiryYear) {
        String newName = requireEmbossedName(embossedName);
        String newStatus = requireActiveStatus(activeStatus);
        requireExpiryMonth(expiryMonth);
        requireExpiryYear(expiryYear);
        LocalDate newExpiration = expiryDateFor(expiryMonth, expiryYear);
        this.embossedName = newName;
        this.activeStatus = newStatus;
        this.expirationDate = newExpiration;
    }

    private LocalDate expiryDateFor(int expiryMonth, int expiryYear) {
        int day = Math.min(expirationDate.getDayOfMonth(), YearMonth.of(expiryYear, expiryMonth).lengthOfMonth());
        return LocalDate.of(expiryYear, expiryMonth, day);
    }

    private static String requireIdentifier(String value, Pattern pattern, int length, String field) {
        if (value == null || !pattern.matcher(value).matches()) {
            throw new BusinessRuleException(VALIDATION_FAILED, field + " must be " + length + " digits.");
        }
        return value;
    }

    private static String requireCvv(String value) {
        if (value == null || !CVV.matcher(value).matches()) {
            throw new BusinessRuleException(VALIDATION_FAILED, "CVV must be 3 digits.");
        }
        return value;
    }

    private static String requireEmbossedName(String value) {
        if (value == null || value.isBlank()) {
            throw new BusinessRuleException(VALIDATION_FAILED, "Embossed Name must be supplied.");
        }
        if (value.length() > 50) {
            throw new BusinessRuleException(VALIDATION_FAILED, "Embossed Name must be 50 characters or less.");
        }
        if (!EMBOSSED_NAME.matcher(value).matches()) {
            throw new BusinessRuleException(VALIDATION_FAILED,
                    "Embossed Name must contain letters and spaces only.");
        }
        return value;
    }

    private static LocalDate requireExpirationDate(LocalDate value) {
        if (value == null) {
            throw new BusinessRuleException(VALIDATION_FAILED, "Expiration Date must be supplied.");
        }
        if (value.getYear() < 1950 || value.getYear() > 2099) {
            throw new BusinessRuleException(VALIDATION_FAILED, "Expiration Date : Year is not valid.");
        }
        return value;
    }

    private static String requireActiveStatus(String value) {
        if (!"Y".equals(value) && !"N".equals(value)) {
            throw new BusinessRuleException(VALIDATION_FAILED, "Card Status must be Y or N.");
        }
        return value;
    }

    private static void requireExpiryMonth(int expiryMonth) {
        if (expiryMonth < 1 || expiryMonth > 12) {
            throw new BusinessRuleException(VALIDATION_FAILED, "Expiry Month must be between 1 and 12.");
        }
    }

    private static void requireExpiryYear(int expiryYear) {
        if (expiryYear < 1950 || expiryYear > 2099) {
            throw new BusinessRuleException(VALIDATION_FAILED, "Expiry Year must be between 1950 and 2099.");
        }
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

    public String getCvv() {
        return cvv;
    }

    public String getEmbossedName() {
        return embossedName;
    }

    public LocalDate getExpirationDate() {
        return expirationDate;
    }

    public String getActiveStatus() {
        return activeStatus;
    }

    public long getVersion() {
        return version;
    }
}
