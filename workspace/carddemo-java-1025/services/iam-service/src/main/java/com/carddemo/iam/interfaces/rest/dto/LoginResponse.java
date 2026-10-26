package com.carddemo.iam.interfaces.rest.dto;

import com.carddemo.iam.application.LoginResult;
import com.carddemo.iam.domain.model.User;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

public record LoginResponse(String token, LocalDateTime expiresAt, AuthenticatedUser user) {

    public static LoginResponse from(LoginResult result) {
        return new LoginResponse(result.token(), utc(result.expiresAt()),
                AuthenticatedUser.from(result.user()));
    }

    static LocalDateTime utc(Instant instant) {
        return LocalDateTime.ofInstant(instant, ZoneOffset.UTC);
    }

    /**
     * BR-SGN-04：landingMenu 为 ADMIN / USER，供前端决定落地菜单。
     */
    public record AuthenticatedUser(String userId, String firstName, String lastName,
                                    String userType, String landingMenu) {

        static AuthenticatedUser from(User user) {
            return new AuthenticatedUser(user.getUserId(), user.getFirstName(), user.getLastName(),
                    user.getUserType(), user.landingMenu());
        }
    }
}
