package com.carddemo.transaction.domain.exception;

/**
 * 业务规则断言失败。映射为 HTTP 409，code 对应错误码总表（docs/design/05-api-catalog.md §7）。
 */
public class BusinessRuleException extends RuntimeException {

    private final String code;

    public BusinessRuleException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
