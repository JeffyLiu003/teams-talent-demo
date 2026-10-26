package com.carddemo.iam.interfaces.rest.dto;

import com.carddemo.iam.domain.model.User;

/**
 * BR-USER-05：用户响应，绝不包含 password / passwordHash。
 */
public record UserResponse(String userId, String firstName, String lastName, String userType,
                           long version) {

    public static UserResponse from(User user) {
        return new UserResponse(user.getUserId(), user.getFirstName(), user.getLastName(),
                user.getUserType(), user.getVersion());
    }
}
