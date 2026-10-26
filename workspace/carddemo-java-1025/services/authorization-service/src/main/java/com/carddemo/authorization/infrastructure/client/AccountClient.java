package com.carddemo.authorization.infrastructure.client;

import com.carddemo.authorization.domain.exception.RemoteServiceException;
import com.carddemo.authorization.domain.model.AccountSnapshot;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Optional;

/**
 * account-service 出站适配器。404 → 空（由调用方拒绝 3100），5xx/超时 → {@link RemoteServiceException}（503）。
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
}
