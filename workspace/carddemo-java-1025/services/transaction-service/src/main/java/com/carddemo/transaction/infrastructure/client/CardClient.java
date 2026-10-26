package com.carddemo.transaction.infrastructure.client;

import com.carddemo.transaction.domain.exception.RemoteServiceException;
import com.carddemo.transaction.domain.model.CardSnapshot;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Optional;

/**
 * card-service 出站适配器。404 → 空（调用方决定业务语义），5xx/超时 → {@link RemoteServiceException}。
 * 日志与错误信息不打印完整卡号。
 */
@Component
public class CardClient {

    private static final String SERVICE = "card-service";

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public CardClient(@Qualifier("cardRestClient") RestClient restClient, ObjectMapper objectMapper) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
    }

    public Optional<CardSnapshot> findCard(String cardNumber) {
        try {
            return restClient.get()
                    .uri("/api/v1/cards/{cardNumber}", cardNumber)
                    .exchange((request, response) -> {
                        int status = response.getStatusCode().value();
                        if (status == 404) {
                            return Optional.<CardSnapshot>empty();
                        }
                        if (!response.getStatusCode().is2xxSuccessful()) {
                            throw new RemoteServiceException(SERVICE + " responded with HTTP " + status);
                        }
                        return Optional.of(objectMapper.readValue(response.getBody(), CardBody.class).toSnapshot());
                    });
        } catch (RestClientException ex) {
            throw new RemoteServiceException(SERVICE + " is unavailable", ex);
        }
    }

    public List<CardSnapshot> findCardsByAccount(String accountId) {
        try {
            return restClient.get()
                    .uri("/api/v1/cards/by-account/{accountId}", accountId)
                    .exchange((request, response) -> {
                        int status = response.getStatusCode().value();
                        if (status == 404) {
                            return List.<CardSnapshot>of();
                        }
                        if (!response.getStatusCode().is2xxSuccessful()) {
                            throw new RemoteServiceException(SERVICE + " responded with HTTP " + status);
                        }
                        CardListBody body = objectMapper.readValue(response.getBody(), CardListBody.class);
                        return body.items() == null ? List.<CardSnapshot>of()
                                : body.items().stream().map(CardBody::toSnapshot).toList();
                    });
        } catch (RestClientException ex) {
            throw new RemoteServiceException(SERVICE + " is unavailable", ex);
        }
    }
}
