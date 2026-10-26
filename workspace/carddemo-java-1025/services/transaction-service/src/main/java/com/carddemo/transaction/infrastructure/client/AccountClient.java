package com.carddemo.transaction.infrastructure.client;

import com.carddemo.transaction.domain.exception.BusinessRuleException;
import com.carddemo.transaction.domain.exception.NotFoundException;
import com.carddemo.transaction.domain.exception.RemoteServiceException;
import com.carddemo.transaction.domain.model.AccountSnapshot;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.util.Optional;

/**
 * account-service 出站适配器。
 * 失败语义（docs/design/03-service-decomposition.md §4）：404 → 实体不存在；409 → 透传下游 code/message；
 * 5xx / 超时 → {@link RemoteServiceException}（HTTP 503 DEPENDENCY_UNAVAILABLE）。
 */
@Component
public class AccountClient {

    private static final String SERVICE = "account-service";

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
                        int status = response.getStatusCode().value();
                        if (status == 404) {
                            return Optional.<AccountSnapshot>empty();
                        }
                        if (!response.getStatusCode().is2xxSuccessful()) {
                            throw new RemoteServiceException(SERVICE + " responded with HTTP " + status);
                        }
                        return Optional.of(objectMapper.readValue(response.getBody(), AccountBody.class).toSnapshot());
                    });
        } catch (RestClientException ex) {
            throw new RemoteServiceException(SERVICE + " is unavailable", ex);
        }
    }

    public AccountSnapshot applyPosting(String accountId, BigDecimal amount) {
        return post(accountId, "postings", amount);
    }

    public AccountSnapshot payBill(String accountId, BigDecimal amount) {
        return post(accountId, "payments", amount);
    }

    public AccountSnapshot accrueInterest(String accountId, BigDecimal amount) {
        return post(accountId, "interest-accruals", amount);
    }

    private AccountSnapshot post(String accountId, String action, BigDecimal amount) {
        try {
            return restClient.post()
                    .uri("/api/v1/accounts/{accountId}/{action}", accountId, action)
                    .body(new AmountBody(amount))
                    .exchange((request, response) -> {
                        int status = response.getStatusCode().value();
                        if (status == 404) {
                            throw new NotFoundException("ACCOUNT_NOT_FOUND",
                                    "Account " + accountId + " not found");
                        }
                        if (status == 409) {
                            ApiErrorBody error = objectMapper.readValue(response.getBody(), ApiErrorBody.class);
                            throw new BusinessRuleException(
                                    error.code() == null ? "BUSINESS_RULE_VIOLATION" : error.code(),
                                    error.message() == null ? "Account operation rejected" : error.message());
                        }
                        if (!response.getStatusCode().is2xxSuccessful()) {
                            throw new RemoteServiceException(SERVICE + " responded with HTTP " + status);
                        }
                        return objectMapper.readValue(response.getBody(), AccountBody.class).toSnapshot();
                    });
        } catch (RestClientException ex) {
            throw new RemoteServiceException(SERVICE + " is unavailable", ex);
        }
    }
}
