package com.carddemo.account.infrastructure.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI accountOpenApi() {
        return new OpenAPI().info(new Info()
                .title("CardDemo Account Service")
                .version("1.0.0")
                .description("账户额度、余额与记账（对应遗留 ACCTDAT）。演示账户：00000000001（额度 2020、余额 1940）。"));
    }
}
