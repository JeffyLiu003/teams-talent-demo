package com.carddemo.customer.infrastructure.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customerOpenApi() {
        return new OpenAPI().info(new Info()
                .title("CardDemo Customer Service")
                .version("1.0.0")
                .description("客户主数据查询与维护（对应遗留 CUSTDAT）。响应中的 SSN 始终为掩码。"));
    }
}
