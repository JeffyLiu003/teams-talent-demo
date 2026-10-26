package com.carddemo.iam.domain.security;

import java.time.Instant;

/**
 * token 校验结果。签名错误或已过期时 {@code valid = false}，不抛异常（供网关判定）。
 */
public record TokenVerification(boolean valid, String userId, String userType, Instant expiresAt) {

    private static final TokenVerification INVALID = new TokenVerification(false, null, null, null);

    public static TokenVerification invalid() {
        return INVALID;
    }
}
