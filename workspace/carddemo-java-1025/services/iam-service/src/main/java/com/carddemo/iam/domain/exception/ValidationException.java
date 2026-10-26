package com.carddemo.iam.domain.exception;

import java.util.List;

/**
 * 字段级校验失败。映射为 HTTP 400 VALIDATION_FAILED，details 保留字段名与遗留文案。
 */
public class ValidationException extends RuntimeException {

    private final String code;
    private final List<String> details;

    public ValidationException(String field, String message) {
        this("VALIDATION_FAILED", message, List.of(field + ": " + message));
    }

    public ValidationException(String code, String message, List<String> details) {
        super(message);
        this.code = code;
        this.details = List.copyOf(details);
    }

    public String getCode() {
        return code;
    }

    public List<String> getDetails() {
        return details;
    }
}
