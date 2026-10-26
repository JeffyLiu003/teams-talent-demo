package com.carddemo.marketing.infrastructure.client;

import com.carddemo.marketing.domain.exception.RemoteServiceException;
import com.carddemo.marketing.domain.model.AccountSnapshot;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.util.Optional;

/**
 * account-service 出站适配器：读账户快照、返现入账（幂等键 rewardId）。
 */
@Component
public class AccountClient {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public AccountClient(@Qualifier("accountRestClient") RestClient restClient, ObjectMapper objectMapper) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
    }

    public Optional<AccountSnapshot> findAccount(String accountId) {
        try {
            return restClient.get()
                    .uri("/api/v1/accounts/{accountId}", accountId)
                    .exchange((request, response) -> {
                        if (response.getStatusCode().value() == 404) {
                            return Optional.<AccountSnapshot>empty();
                        }
                        if (!response.getStatusCode().is2xxSuccessful()) {
                            throw new RemoteServiceException("account-service responded with HTTP "
                                    + response.getStatusCode().value());
                        }
                        AccountBody body = objectMapper.readValue(response.getBody(), AccountBody.class);
                        return Optional.of(body.toSnapshot());
                    });
        } catch (RestClientException ex) {
            throw new RemoteServiceException("account-service is unavailable", ex);
        }
    }

    public void creditCashback(String accountId, String rewardId, String campaignId, BigDecimal amount) {
        try {
            restClient.post()
                    .uri("/api/v1/accounts/{accountId}/cashback-credits", accountId)
                    .body(new CashbackCreditBody(rewardId, campaignId, amount))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException ex) {
            throw new RemoteServiceException("account-service cashback credit failed", ex);
        }
    }

    record AccountBody(String accountId, String activeStatus, BigDecimal currentBalance, String groupId) {
        AccountSnapshot toSnapshot() {
            return new AccountSnapshot(accountId, activeStatus, currentBalance, groupId);
        }
    }

    record CashbackCreditBody(String rewardId, String campaignId, BigDecimal amount) {
    }
}
