package com.carddemo.iam.application;

import com.carddemo.iam.domain.model.User;

import java.time.Instant;

/**
 * 登录成功结果：token、到期时刻与认证通过的用户。
 */
public record LoginResult(String token, Instant expiresAt, User user) {
}
