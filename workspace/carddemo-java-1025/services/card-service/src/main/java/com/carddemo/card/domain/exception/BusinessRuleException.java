package com.carddemo.card.domain.exception;

/**
 * 业务规则断言失败。映射为 HTTP 409；code 为 VALIDATION_FAILED 时映射为 400（输入不合法）。
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
