package com.carddemo.iam.interfaces.rest.dto;

import com.carddemo.iam.domain.model.UserDetails;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * BR-USER-06：修改用户；password 可省略（保持不变）。
 */
public record UpdateUserRequest(
        @NotBlank(message = "First Name must be supplied.")
        @Size(max = 20, message = "First Name must be 20 characters or fewer.")
        String firstName,

        @NotBlank(message = "Last Name must be supplied.")
        @Size(max = 20, message = "Last Name must be 20 characters or fewer.")
        String lastName,

        @NotNull(message = "User Type must be supplied.")
        @Pattern(regexp = "[AU]", message = "User Type must be A or U.")
        String userType,

        @Size(min = 8, max = 64, message = "Password must be 8 to 64 characters.")
        String password) {

    public UserDetails toDetails() {
        return new UserDetails(firstName, lastName, userType);
    }
}
