package com.carddemo.iam.application;

import com.carddemo.iam.domain.exception.UnauthorizedException;
import com.carddemo.iam.domain.security.TokenVerification;
import com.carddemo.iam.infrastructure.security.HmacTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 登录用例：种子凭据可通过 PBKDF2 校验并签发 token（H2 + Flyway 种子）。
 */
@SpringBootTest
@ActiveProfiles("test")
class AuthenticationServiceTest {

    @Autowired
    private AuthenticationService authenticationService;

    @Test
    void logsInWithSeededAdministratorCredentials() {
        LoginResult result = authenticationService.login("ADMIN001", "admin123");

        assertThat(result.token()).isNotBlank().contains(".");
        assertThat(result.expiresAt()).isAfter(Instant.now());
        assertThat(result.user().getUserId()).isEqualTo("ADMIN001");
        assertThat(result.user().getUserType()).isEqualTo("A");
        assertThat(result.user().landingMenu()).isEqualTo("ADMIN");
        assertThat(result.user().getPasswordHash()).startsWith("pbkdf2$210000$");
    }

    @Test
    void logsInWithSeededUserCredentialsAndLandsOnUserMenu() {
        LoginResult result = authenticationService.login("USER0001", "user1234");

        assertThat(result.user().landingMenu()).isEqualTo("USER");
        assertThat(result.user().getUserType()).isEqualTo("U");
    }

    @Test
    void normalizesUserIdCaseAndWhitespaceButNotPasswordCase() {
        assertThat(authenticationService.login(" admin001 ", "admin123").user().getUserId())
                .isEqualTo("ADMIN001");

        assertThatThrownBy(() -> authenticationService.login("ADMIN001", "ADMIN123"))
                .isInstanceOf(UnauthorizedException.class)
                .extracting("code").isEqualTo("INVALID_CREDENTIALS");
    }

    @Test
    void rejectsWrongPasswordWithInvalidCredentials() {
        assertThatThrownBy(() -> authenticationService.login("ADMIN001", "wrong-pass"))
                .isInstanceOf(UnauthorizedException.class)
                .extracting("code").isEqualTo("INVALID_CREDENTIALS");
    }

    @Test
    void hidesUnknownUserBehindSameError() {
        assertThatThrownBy(() -> authenticationService.login("NOBODY01", "admin123"))
                .isInstanceOf(UnauthorizedException.class)
                .extracting("code").isEqualTo("INVALID_CREDENTIALS");
    }

    @Test
    void verifiesIssuedToken() {
        String token = authenticationService.login("ADMIN001", "admin123").token();

        TokenVerification verification = authenticationService.verify(token);

        assertThat(verification.valid()).isTrue();
        assertThat(verification.userId()).isEqualTo("ADMIN001");
        assertThat(verification.userType()).isEqualTo("A");
        assertThat(verification.expiresAt()).isAfter(Instant.now());
    }

    @Test
    void rejectsTamperedTokenWithoutThrowing() {
        String token = authenticationService.login("ADMIN001", "admin123").token();
        String tampered = token.substring(0, token.indexOf('.') + 1) + "AAAA";

        assertThat(authenticationService.verify(tampered).valid()).isFalse();
        assertThat(authenticationService.verify("garbage").valid()).isFalse();
        assertThat(authenticationService.verify(null).valid()).isFalse();
    }

    @Test
    void rejectsExpiredTokenWithoutThrowing() {
        HmacTokenService expiring = new HmacTokenService("carddemo-demo-secret-change-me", -10);
        String expired = expiring.issue("ADMIN001", "A").value();

        TokenVerification verification = expiring.verify(expired);

        assertThat(verification.valid()).isFalse();
        assertThat(verification.userId()).isNull();
    }
}
