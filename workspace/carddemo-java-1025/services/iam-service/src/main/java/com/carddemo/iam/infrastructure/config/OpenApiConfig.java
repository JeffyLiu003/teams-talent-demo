package com.carddemo.iam.infrastructure.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI iamOpenApi() {
        return new OpenAPI().info(new Info()
                .title("CardDemo IAM Service")
                .version("1.0.0")
                .description("登录与用户管理。演示账号：ADMIN001 / admin123（管理员）、USER0001 / user1234（普通用户）。"
                        + "登录请求体已预填 ADMIN001 凭据，直接点击 Execute 即可。"));
    }
}
