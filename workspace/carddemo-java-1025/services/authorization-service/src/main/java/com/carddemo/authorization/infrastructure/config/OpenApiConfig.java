package com.carddemo.authorization.infrastructure.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI authorizationOpenApi() {
        return new OpenAPI().info(new Info()
                .title("CardDemo Authorization Service")
                .version("1.0.0")
                .description("信用卡授权决策、待授权汇总与欺诈标记（对应遗留 COPAUA0C/COPAUS*/CBPAUP0C）。"
                        + "演示卡号：0500024453765740（账户 1，额度 2020、余额 1940，可用 80）。"));
    }
}
