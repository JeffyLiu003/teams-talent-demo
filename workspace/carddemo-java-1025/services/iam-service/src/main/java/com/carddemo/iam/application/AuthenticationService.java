package com.carddemo.iam.application;

import com.carddemo.iam.domain.exception.UnauthorizedException;
import com.carddemo.iam.domain.model.User;
import com.carddemo.iam.domain.repository.UserRepository;
import com.carddemo.iam.domain.security.IssuedToken;
import com.carddemo.iam.domain.security.PasswordHasher;
import com.carddemo.iam.domain.security.TokenService;
import com.carddemo.iam.domain.security.TokenVerification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 登录用例。对应遗留程序 COSGN00C。
 * <p>
 * BR-SGN-01/02：用户号与密码均必填、用户号 trim + 大写、密码 trim 但不转换大小写；
 * BR-SGN-03：凭据错误统一 401 INVALID_CREDENTIALS（ADR-008，不区分用户不存在与密码错误）。
 */
@Service
@Transactional(readOnly = true)
public class AuthenticationService {

    private final UserRepository users;
    private final PasswordHasher passwordHasher;
    private final TokenService tokenService;

    public AuthenticationService(UserRepository users, PasswordHasher passwordHasher,
                                 TokenService tokenService) {
        this.users = users;
        this.passwordHasher = passwordHasher;
        this.tokenService = tokenService;
    }

    public LoginResult login(String rawUserId, String rawPassword) {
        String userId = User.normalizeUserId(rawUserId);
        String password = rawPassword == null ? "" : rawPassword.trim();

        User user = (userId == null ? null : users.findByUserId(userId).orElse(null));
        if (user == null || !passwordHasher.verify(password, user.getPasswordHash())) {
            throw new UnauthorizedException("INVALID_CREDENTIALS", "Invalid user ID or password.");
        }

        IssuedToken issued = tokenService.issue(user.getUserId(), user.getUserType());
        return new LoginResult(issued.value(), issued.expiresAt(), user);
    }

    public TokenVerification verify(String token) {
        return tokenService.verify(token);
    }
}
