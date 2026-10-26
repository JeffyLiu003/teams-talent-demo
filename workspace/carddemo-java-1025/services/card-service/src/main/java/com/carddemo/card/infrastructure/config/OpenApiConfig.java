package com.carddemo.card.infrastructure.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI cardOpenApi() {
        return new OpenAPI().info(new Info()
                .title("CardDemo Card Service")
                .version("1.0.0")
                .description("卡片与卡-账户-客户映射（对应遗留 CARDDAT/CCXREF）。响应不含 CVV。"));
    }
}
