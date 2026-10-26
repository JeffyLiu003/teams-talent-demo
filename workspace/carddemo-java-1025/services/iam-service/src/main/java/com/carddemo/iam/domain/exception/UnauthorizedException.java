package com.carddemo.iam.domain.exception;

/**
 * 身份认证失败。映射为 HTTP 401（ADR-008：不区分“用户不存在”与“密码错误”）。
 */
public class UnauthorizedException extends RuntimeException {

    private final String code;

    public UnauthorizedException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
