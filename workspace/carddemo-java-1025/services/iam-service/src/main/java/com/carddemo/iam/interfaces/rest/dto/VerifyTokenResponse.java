package com.carddemo.iam.interfaces.rest.dto;

import com.carddemo.iam.domain.security.TokenVerification;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

/**
 * ADR-007：无效或过期时只返回 {@code {"valid": false}}，不返回 401。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record VerifyTokenResponse(boolean valid, String userId, String userType,
                                  LocalDateTime expiresAt) {

    public static VerifyTokenResponse from(TokenVerification verification) {
        if (!verification.valid()) {
            return new VerifyTokenResponse(false, null, null, null);
        }
        return new VerifyTokenResponse(true, verification.userId(), verification.userType(),
                LocalDateTime.ofInstant(verification.expiresAt(), ZoneOffset.UTC));
    }
}
