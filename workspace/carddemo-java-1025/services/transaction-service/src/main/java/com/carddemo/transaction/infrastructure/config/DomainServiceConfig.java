package com.carddemo.transaction.infrastructure.config;

import com.carddemo.transaction.domain.service.InterestCalculator;
import com.carddemo.transaction.domain.service.PostingPolicy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 纯领域服务的装配。领域服务本身不依赖 Spring。
 */
@Configuration
public class DomainServiceConfig {

    @Bean
    public PostingPolicy postingPolicy() {
        return new PostingPolicy();
    }

    @Bean
    public InterestCalculator interestCalculator() {
        return new InterestCalculator();
    }
}
