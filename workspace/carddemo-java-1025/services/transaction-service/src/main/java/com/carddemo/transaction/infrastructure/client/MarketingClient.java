package com.carddemo.transaction.infrastructure.client;

import com.carddemo.transaction.domain.exception.RemoteServiceException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * marketing-service 出站适配器：消费入账后触发奖励评估。
 * 营销不可用不影响入账（调用方捕获异常并告警），见 ADR-009。
 */
@Component
public class MarketingClient {

    private final RestClient restClient;

    public MarketingClient(@Qualifier("marketingRestClient") RestClient restClient) {
        this.restClient = restClient;
    }

    public void evaluateRewards(RewardEvaluationCommand command) {
        try {
            restClient.post()
                    .uri("/api/v1/reward-evaluations")
                    .body(command)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException ex) {
            throw new RemoteServiceException("marketing-service is unavailable", ex);
        }
    }

    public record RewardEvaluationCommand(String transactionId, String cardNumber, String accountId,
                                          String customerId, BigDecimal amount, String categoryCode,
                                          String typeCode, String description,
                                          LocalDateTime processedAt) {
    }
}
