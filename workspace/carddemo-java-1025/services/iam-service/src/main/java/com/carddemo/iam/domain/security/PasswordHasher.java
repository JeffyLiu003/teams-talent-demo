package com.carddemo.iam.domain.security;

/**
 * 密码哈希端口。ADR-008：PBKDF2-HMAC-SHA256，每用户随机盐，只保存编码后的哈希。
 */
public interface PasswordHasher {

    String hash(String rawPassword);

    boolean verify(String rawPassword, String encodedPassword);
}
