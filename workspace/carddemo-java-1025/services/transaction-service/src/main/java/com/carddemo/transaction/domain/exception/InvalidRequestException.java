package com.carddemo.transaction.domain.exception;

/**
 * 请求语义不成立（例如账户号与卡号同时缺失、卡号与账户号不匹配）。映射为 HTTP 400。
 */
public class InvalidRequestException extends RuntimeException {

    private final String code;

    public InvalidRequestException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
