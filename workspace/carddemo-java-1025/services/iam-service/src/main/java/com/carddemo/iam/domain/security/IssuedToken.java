package com.carddemo.iam.domain.security;

import java.time.Instant;

/**
 * 签发的 token 与到期时刻（ADR-007）。
 */
public record IssuedToken(String value, Instant expiresAt) {
}
