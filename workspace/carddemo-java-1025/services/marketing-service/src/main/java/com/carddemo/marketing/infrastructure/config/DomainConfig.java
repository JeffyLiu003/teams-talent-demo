package com.carddemo.marketing.infrastructure.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
public class DomainConfig {

    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }
}
