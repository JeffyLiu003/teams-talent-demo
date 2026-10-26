package com.carddemo.authorization.domain.model;

import com.carddemo.authorization.domain.exception.BusinessRuleException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 授权明细聚合根。对应遗留 AUTHFRDS（COPAUA0C 每笔授权写一条）。
 * 不变量：responseCode ∈ {00, 05}；拒绝（05）时 approvedAmount 必须为 0；reasonCode 非空。
 */
@Entity
@Table(name = "auth_detail")
public class AuthorizationCase {

    public static final String APPROVED = "00";
    public static final String DECLINED = "05";
    public static final String FRAUD_FLAGGED = "Y";
    public static final String FRAUD_CLEAR = "N";

    private static final BigDecimal ZERO = new BigDecimal("0.00");

    @Id
    @Column(name = "authorization_id", length = 36, nullable = false, updatable = false)
    private String authorizationId;

    @Column(name = "card_number", length = 16, nullable = false)
    private String cardNumber;

    @Column(name = "auth_timestamp", nullable = false)
    private LocalDateTime authTimestamp;

    @Column(name = "auth_type", length = 4)
    private String authType;

    @Column(name = "card_expiry_date", length = 4)
    private String cardExpiryDate;

    @Column(name = "message_type", length = 6)
    private String messageType;

    @Column(name = "message_source", length = 6)
    private String messageSource;

    @Column(name = "auth_id_code", length = 6)
    private String authIdCode;

    @Column(name = "response_code", length = 2, nullable = false)
    private String responseCode;

    @Column(name = "reason_code", length = 4, nullable = false)
    private String reasonCode;

    @Column(name = "processing_code", length = 6)
    private String processingCode;

    @Column(name = "transaction_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal transactionAmount;

    @Column(name = "approved_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal approvedAmount;

    @Column(name = "merchant_category_code", length = 4)
    private String merchantCategoryCode;

    @Column(name = "acquirer_country_code", length = 3)
    private String acquirerCountryCode;

    @Column(name = "pos_entry_mode")
    private Integer posEntryMode;

    @Column(name = "merchant_id", length = 15)
    private String merchantId;

    @Column(name = "merchant_name", length = 22)
    private String merchantName;

    @Column(name = "merchant_city", length = 13)
    private String merchantCity;

    @Column(name = "merchant_state", length = 2)
    private String merchantState;

    @Column(name = "merchant_zip", length = 9)
    private String merchantZip;

    @Column(name = "transaction_id", length = 15)
    private String transactionId;

    @Column(name = "fraud_flag", length = 1, nullable = false)
    private String fraudFlag;

    @Column(name = "account_id", length = 11)
    private String accountId;

    @Column(name = "customer_id", length = 9)
    private String customerId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    protected AuthorizationCase() {
        // for JPA
    }

    /**
     * 新建一笔授权（authorizationId 由服务端生成 UUID），决策前 responseCode 尚未确定。
     */
    public AuthorizationCase(AuthorizationRequest request) {
        this.authorizationId = UUID.randomUUID().toString();
        this.cardNumber = request.cardNumber();
        this.authTimestamp = request.authTimestamp();
        this.authType = request.authType();
        this.cardExpiryDate = request.cardExpiryDate();
        this.messageType = request.messageType();
        this.messageSource = request.messageSource();
        this.processingCode = request.processingCode();
        this.transactionAmount = request.transactionAmount().setScale(2, RoundingMode.HALF_UP);
        this.approvedAmount = ZERO;
        this.merchantCategoryCode = request.merchantCategoryCode();
        this.acquirerCountryCode = request.acquirerCountryCode();
        this.posEntryMode = request.posEntryMode();
        this.merchantId = request.merchantId();
        this.merchantName = request.merchantName();
        this.merchantCity = request.merchantCity();
        this.merchantState = request.merchantState();
        this.merchantZip = request.merchantZip();
        this.transactionId = request.transactionId();
        this.accountId = request.accountId();
        this.customerId = request.customerId();
        this.fraudFlag = FRAUD_CLEAR;
        this.createdAt = LocalDateTime.now();
    }

    /**
     * BR-AUTH-08：写入决策结果。批准（00）金额为交易金额，拒绝（05）金额为 0。
     */
    public void decide(String responseCode, String reasonCode, BigDecimal approvedAmount) {
        if (!APPROVED.equals(responseCode) && !DECLINED.equals(responseCode)) {
            throw new BusinessRuleException("INVALID_RESPONSE_CODE",
                    "Authorization response code must be 00 or 05.");
        }
        if (reasonCode == null || reasonCode.isBlank()) {
            throw new BusinessRuleException("MISSING_REASON_CODE",
                    "Authorization reason code must be supplied.");
        }
        BigDecimal approved = approvedAmount == null ? ZERO : approvedAmount.setScale(2, RoundingMode.HALF_UP);
        if (DECLINED.equals(responseCode) && approved.signum() != 0) {
            throw new BusinessRuleException("INVALID_APPROVED_AMOUNT",
                    "Declined authorization must approve 0.00.");
        }
        this.responseCode = responseCode;
        this.reasonCode = reasonCode;
        this.approvedAmount = approved;
    }

    /**
     * BR-AUTH-12：人工标记欺诈。卡级欺诈标记另存 card_fraud_flag。
     */
    public void markFraud() {
        this.fraudFlag = FRAUD_FLAGGED;
    }

    public boolean isApproved() {
        return APPROVED.equals(responseCode);
    }

    public String getAuthorizationId() {
        return authorizationId;
    }

    public String getCardNumber() {
        return cardNumber;
    }

    public LocalDateTime getAuthTimestamp() {
        return authTimestamp;
    }

    public String getAuthType() {
        return authType;
    }

    public String getCardExpiryDate() {
        return cardExpiryDate;
    }

    public String getMessageType() {
        return messageType;
    }

    public String getMessageSource() {
        return messageSource;
    }

    public String getAuthIdCode() {
        return authIdCode;
    }

    public String getResponseCode() {
        return responseCode;
    }

    public String getReasonCode() {
        return reasonCode;
    }

    public String getProcessingCode() {
        return processingCode;
    }

    public BigDecimal getTransactionAmount() {
        return transactionAmount;
    }

    public BigDecimal getApprovedAmount() {
        return approvedAmount;
    }

    public String getMerchantCategoryCode() {
        return merchantCategoryCode;
    }

    public String getAcquirerCountryCode() {
        return acquirerCountryCode;
    }

    public Integer getPosEntryMode() {
        return posEntryMode;
    }

    public String getMerchantId() {
        return merchantId;
    }

    public String getMerchantName() {
        return merchantName;
    }

    public String getMerchantCity() {
        return merchantCity;
    }

    public String getMerchantState() {
        return merchantState;
    }

    public String getMerchantZip() {
        return merchantZip;
    }

    public String getTransactionId() {
        return transactionId;
    }

    public String getFraudFlag() {
        return fraudFlag;
    }

    public String getAccountId() {
        return accountId;
    }

    public String getCustomerId() {
        return customerId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
