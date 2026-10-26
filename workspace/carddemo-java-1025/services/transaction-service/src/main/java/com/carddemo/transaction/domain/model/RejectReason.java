package com.carddemo.transaction.domain.model;

/**
 * 入账校验失败码（CBTRN02C，见数据字典 §3.2）。写入 daily_transaction 的 reject_reason_code / reject_reason。
 */
public enum RejectReason {

    INVALID_CARD_NUMBER(100, "INVALID CARD NUMBER FOUND"),
    ACCOUNT_NOT_FOUND(101, "ACCOUNT RECORD NOT FOUND"),
    OVERLIMIT(102, "OVERLIMIT TRANSACTION"),
    ACCOUNT_EXPIRED(103, "TRANSACTION RECEIVED AFTER ACCT EXPIRATION");

    private final int code;
    private final String description;

    RejectReason(int code, String description) {
        this.code = code;
        this.description = description;
    }

    public int getCode() {
        return code;
    }

    public String getDescription() {
        return description;
    }
}
