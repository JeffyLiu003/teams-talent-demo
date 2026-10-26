package com.carddemo.iam.interfaces.rest.dto;

import com.carddemo.iam.domain.model.UserDetails;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * BR-USER-01..04：新增用户五项必填；用户号 8 位字母数字、姓名 1-20、密码 8-64、类型 A/U。
 */
public record CreateUserRequest(
        @Schema(description = "用户号（8 位字母数字）", example = "USER0002",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "User ID must be supplied.")
        @Pattern(regexp = "^[A-Za-z0-9]{8}$", message = "User ID must be 8 alphanumeric characters.")
        String userId,

        @Schema(description = "名", example = "Ada", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "First Name must be supplied.")
        @Size(max = 20, message = "First Name must be 20 characters or fewer.")
        String firstName,

        @Schema(description = "姓", example = "Lovelace", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "Last Name must be supplied.")
        @Size(max = 20, message = "Last Name must be 20 characters or fewer.")
        String lastName,

        @Schema(description = "密码（8-64 位）", example = "pass1234",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "Password must be supplied.")
        @Size(min = 8, max = 64, message = "Password must be 8 to 64 characters.")
        String password,

        @Schema(description = "用户类型 A=管理员 / U=普通用户", example = "U",
                allowableValues = {"A", "U"}, requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "User Type must be supplied.")
        @Pattern(regexp = "[AU]", message = "User Type must be A or U.")
        String userType) {

    public UserDetails toDetails() {
        return new UserDetails(firstName, lastName, userType);
    }
}
