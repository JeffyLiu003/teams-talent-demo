package com.carddemo.iam.interfaces.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/**
 * BR-SGN-01：用户号与密码均必填。
 * Swagger UI 已预填演示账号（ADMIN001 / admin123），点击 Execute 即可登录。
 */
public record LoginRequest(
        @Schema(description = "用户号（8 位，忽略大小写，服务端转大写）",
                example = "ADMIN001",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "User ID must be supplied.")
        String userId,

        @Schema(description = "密码（普通用户演示账号：USER0001 / user1234）",
                example = "admin123",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "Password must be supplied.")
        String password) {
}
