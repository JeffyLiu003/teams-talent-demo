package com.carddemo.authorization.domain.exception;

/**
 * 请求语义不成立（例如分页参数越界）。映射为 HTTP 400。
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
