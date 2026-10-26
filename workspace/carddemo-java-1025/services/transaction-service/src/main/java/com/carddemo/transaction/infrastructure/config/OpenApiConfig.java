package com.carddemo.transaction.infrastructure.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI transactionOpenApi() {
        return new OpenAPI().info(new Info()
                .title("CardDemo Transaction Service")
                .version("1.0.0")
                .description("交易录入、日终入账、利息、账单支付与报表（对应遗留 TRANSACT/DALYTRAN/TCATBALF）。"
                        + "演示卡号：3344556677889900（账户 6，未过期）；账单支付账户：00000000001。"));
    }
}
