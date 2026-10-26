package com.carddemo.transaction.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 日交易明细（原 DALYTRAN + DALYREJS）。通过校验的写入 POSTED；拒付的写入 REJECTED 带原因码（BR-POST-05）。
 */
@Entity
@Table(name = "daily_transaction")
public class DailyTransaction {

    @Id
    @Column(name = "transaction_id", length = 16, nullable = false, updatable = false)
    private String transactionId;

    @Column(name = "card_number", length = 16)
    private String cardNumber;

    @Column(name = "type_code", length = 2, nullable = false)
    private String typeCode;

    @Column(name = "category_code", length = 4, nullable = false)
    private String categoryCode;

    @Column(name = "source", length = 10, nullable = false)
    private String source;

    @Column(name = "description", length = 100, nullable = false)
    private String description;

    @Column(name = "amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "merchant_id", length = 9, nullable = false)
    private String merchantId;

    @Column(name = "merchant_name", length = 50, nullable = false)
    private String merchantName;

    @Column(name = "merchant_city", length = 50, nullable = false)
    private String merchantCity;

    @Column(name = "merchant_zip", length = 10, nullable = false)
    private String merchantZip;

    @Column(name = "original_timestamp", nullable = false)
    private LocalDateTime originalTimestamp;

    @Column(name = "processed_timestamp", nullable = false)
    private LocalDateTime processedTimestamp;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 10, nullable = false)
    private DailyTransactionStatus status;

    @Column(name = "reject_reason_code")
    private Integer rejectReasonCode;

    @Column(name = "reject_reason", length = 76)
    private String rejectReason;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected DailyTransaction() {
        // for JPA
    }

    private DailyTransaction(String transactionId,
                             String cardNumber,
                             String typeCode,
                             String categoryCode,
                             String source,
                             String description,
                             BigDecimal amount,
                             String merchantId,
                             String merchantName,
                             String merchantCity,
                             String merchantZip,
                             LocalDateTime originalTimestamp,
                             LocalDateTime processedTimestamp,
                             DailyTransactionStatus status,
                             RejectReason reason) {
        this.transactionId = transactionId;
        this.cardNumber = cardNumber;
        this.typeCode = typeCode;
        this.categoryCode = categoryCode;
        this.source = source;
        this.description = description;
        this.amount = amount;
        this.merchantId = merchantId;
        this.merchantName = merchantName;
        this.merchantCity = merchantCity;
        this.merchantZip = merchantZip;
        this.originalTimestamp = originalTimestamp;
        this.processedTimestamp = processedTimestamp;
        this.status = status;
        this.rejectReasonCode = reason == null ? null : reason.getCode();
        this.rejectReason = reason == null ? null : reason.getDescription();
    }

    public static DailyTransaction posted(TransactionRecord record) {
        return new DailyTransaction(record.getTransactionId(), record.getCardNumber(), record.getTypeCode(),
                record.getCategoryCode(), record.getSource(), record.getDescription(), record.getAmount(),
                record.getMerchantId(), record.getMerchantName(), record.getMerchantCity(), record.getMerchantZip(),
                record.getOriginalTimestamp(), record.getProcessedTimestamp(), DailyTransactionStatus.POSTED, null);
    }

    public static DailyTransaction rejected(String transactionId,
                                            String cardNumber,
                                            String typeCode,
                                            String categoryCode,
                                            String source,
                                            String description,
                                            BigDecimal amount,
                                            String merchantId,
                                            String merchantName,
                                            String merchantCity,
                                            String merchantZip,
                                            LocalDateTime originalTimestamp,
                                            LocalDateTime processedTimestamp,
                                            RejectReason reason) {
        return new DailyTransaction(transactionId, cardNumber, typeCode, categoryCode, source, description, amount,
                merchantId, merchantName, merchantCity, merchantZip, originalTimestamp, processedTimestamp,
                DailyTransactionStatus.REJECTED, reason);
    }

    public String getTransactionId() {
        return transactionId;
    }

    public String getCardNumber() {
        return cardNumber;
    }

    public String getTypeCode() {
        return typeCode;
    }

    public String getCategoryCode() {
        return categoryCode;
    }

    public String getSource() {
        return source;
    }

    public String getDescription() {
        return description;
    }

    public BigDecimal getAmount() {
        return amount;
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

    public String getMerchantZip() {
        return merchantZip;
    }

    public LocalDateTime getOriginalTimestamp() {
        return originalTimestamp;
    }

    public LocalDateTime getProcessedTimestamp() {
        return processedTimestamp;
    }

    public DailyTransactionStatus getStatus() {
        return status;
    }

    public Integer getRejectReasonCode() {
        return rejectReasonCode;
    }

    public String getRejectReason() {
        return rejectReason;
    }

    public long getVersion() {
        return version;
    }
}
