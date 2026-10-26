package com.carddemo.iam.domain.security;

/**
 * token 签发与校验端口。ADR-007：HMAC-SHA256，payload 为 {@code userId|userType|expiresAtEpochSecond}。
 */
public interface TokenService {

    IssuedToken issue(String userId, String userType);

    TokenVerification verify(String token);
}
