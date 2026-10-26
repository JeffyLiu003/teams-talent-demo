package com.carddemo.customer.domain.exception;

/**
 * 业务规则断言失败。映射为 HTTP 409，code 对应规则目录中的规则或错误码。
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
