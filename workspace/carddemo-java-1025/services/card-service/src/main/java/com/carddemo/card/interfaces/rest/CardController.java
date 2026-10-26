package com.carddemo.card.interfaces.rest;

import com.carddemo.card.application.CardApplicationService;
import com.carddemo.card.domain.model.Card;
import com.carddemo.card.interfaces.rest.dto.CardPageResponse;
import com.carddemo.card.interfaces.rest.dto.CardResponse;
import com.carddemo.card.interfaces.rest.dto.CreateCardRequest;
import com.carddemo.card.interfaces.rest.dto.UpdateCardRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/cards")
@Validated
public class CardController {

    private static final String CARD_NUMBER = "\\d{16}";
    private static final String ACCOUNT_ID = "^$|\\d{11}";
    private static final String CUSTOMER_ID = "^$|\\d{9}";

    private final CardApplicationService cardService;

    public CardController(CardApplicationService cardService) {
        this.cardService = cardService;
    }

    @GetMapping
    public CardPageResponse list(
            @RequestParam(required = false)
            @Pattern(regexp = ACCOUNT_ID, message = "Account ID must be 11 digits.")
            String accountId,
            @RequestParam(required = false)
            @Pattern(regexp = CUSTOMER_ID, message = "Customer ID must be 9 digits.")
            String customerId,
            @RequestParam(defaultValue = "0")
            @Min(value = 0, message = "Page must not be negative.")
            int page,
            @RequestParam(defaultValue = "7")
            @Min(value = 1, message = "Size must be between 1 and 100.")
            @Max(value = 100, message = "Size must be between 1 and 100.")
            int size) {
        return CardPageResponse.from(cardService.list(accountId, customerId, page, size));
    }

    @GetMapping("/by-account/{accountId}")
    public Map<String, List<CardResponse>> listByAccount(
            @PathVariable
            @Pattern(regexp = "\\d{11}", message = "Account ID must be 11 digits.")
            String accountId) {
        List<CardResponse> items = cardService.listByAccount(accountId).stream()
                .map(CardResponse::from)
                .toList();
        return Map.of("items", items);
    }

    @GetMapping("/{cardNumber}")
    public CardResponse get(
            @PathVariable
            @Pattern(regexp = CARD_NUMBER, message = "Card Number must be 16 digits.")
            String cardNumber) {
        return CardResponse.from(cardService.get(cardNumber));
    }

    @PostMapping
    public ResponseEntity<CardResponse> create(@Valid @RequestBody CreateCardRequest request) {
        Card card = cardService.create(request.toRegistration());
        return ResponseEntity.created(URI.create("/api/v1/cards/" + card.getCardNumber()))
                .body(CardResponse.from(card));
    }

    @PutMapping("/{cardNumber}")
    public CardResponse update(
            @PathVariable
            @Pattern(regexp = CARD_NUMBER, message = "Card Number must be 16 digits.")
            String cardNumber,
            @Valid @RequestBody UpdateCardRequest request) {
        return CardResponse.from(cardService.update(cardNumber, request.toMaintenance()));
    }
}
