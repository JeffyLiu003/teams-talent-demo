package com.carddemo.marketing.infrastructure.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI marketingOpenApi() {
        return new OpenAPI().info(new Info()
                .title("CardDemo Marketing Service")
                .version("1.0.0")
                .description("信用卡营销：活动配置、报名、消费返现/积分、活动效果。"
                        + "演示数据：餐饮 5% 返现（卡 0500024453765740 已报名）、开卡首刷礼、现金预支双倍积分。"));
    }
}
