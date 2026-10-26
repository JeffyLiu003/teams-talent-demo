package com.carddemo.card.domain.exception;

/**
 * 查询不到聚合根。映射为 HTTP 404。
 */
public class NotFoundException extends RuntimeException {

    private final String code;

    public NotFoundException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
