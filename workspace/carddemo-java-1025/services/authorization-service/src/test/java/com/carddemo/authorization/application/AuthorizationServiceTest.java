package com.carddemo.authorization.application;

import com.carddemo.authorization.domain.model.AccountSnapshot;
import com.carddemo.authorization.domain.model.AuthorizationCase;
import com.carddemo.authorization.domain.model.AuthorizationRequest;
import com.carddemo.authorization.domain.model.AuthorizationSummary;
import com.carddemo.authorization.domain.model.CardFraudFlag;
import com.carddemo.authorization.domain.model.CardSnapshot;
import com.carddemo.authorization.domain.model.CustomerSnapshot;
import com.carddemo.authorization.domain.repository.AuthorizationRepository;
import com.carddemo.authorization.domain.repository.AuthorizationSummaryRepository;
import com.carddemo.authorization.domain.repository.CardFraudFlagRepository;
import com.carddemo.authorization.domain.service.AuthorizationPolicy;
import com.carddemo.authorization.infrastructure.client.AccountClient;
import com.carddemo.authorization.infrastructure.client.CardClient;
import com.carddemo.authorization.infrastructure.client.CustomerClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * BR-AUTH-01..11：授权用例编排（Mockito 隔离下游与仓储）。
 */
@ExtendWith(MockitoExtension.class)
class AuthorizationServiceTest {

    private static final String CARD_NUMBER = "0500024453765740";
    private static final String ACCOUNT_ID = "00000000001";
    private static final String CUSTOMER_ID = "000000001";

    @Mock
    private AuthorizationRepository authorizations;

    @Mock
    private AuthorizationSummaryRepository summaries;

    @Mock
    private CardFraudFlagRepository fraudFlags;

    @Mock
    private CardClient cardClient;

    @Mock
    private AccountClient accountClient;

    @Mock
    private CustomerClient customerClient;

    private AuthorizationService service;

    private final CardSnapshot card = new CardSnapshot(CARD_NUMBER, ACCOUNT_ID, CUSTOMER_ID, "Y",
            LocalDate.of(2028, 5, 20));

    private final CustomerSnapshot customer = new CustomerSnapshot(CUSTOMER_ID);

    private final AccountSnapshot account = new AccountSnapshot(ACCOUNT_ID, "Y",
            new BigDecimal("1940.00"), new BigDecimal("2020.00"), new BigDecimal("1020.00"));

    @BeforeEach
    void setUp() {
        service = new AuthorizationService(authorizations, summaries, fraudFlags, cardClient,
                accountClient, customerClient, new AuthorizationPolicy());
    }

    private AuthorizationCommand command(String amount) {
        return new AuthorizationCommand(CARD_NUMBER, new BigDecimal(amount), "01", "2805", "0100", "POS",
                "000000", "5411", "USA", 5, "MERCHANT0000001", "Corner Grocery", "Springfield", "IL",
                "62704", "TXN000000000001", LocalDateTime.of(2026, 10, 25, 10, 15));
    }

    private void stubExistingCardAndParties() {
        when(cardClient.findCard(CARD_NUMBER)).thenReturn(Optional.of(card));
        when(customerClient.findCustomer(CUSTOMER_ID)).thenReturn(Optional.of(customer));
        when(accountClient.findAccount(ACCOUNT_ID)).thenReturn(Optional.of(account));
    }

    @Test
    void approvesAndAccumulatesSummaryFromAccountLimits() {
        stubExistingCardAndParties();
        when(summaries.findSummary(ACCOUNT_ID)).thenReturn(Optional.empty());
        when(fraudFlags.findFlag(CARD_NUMBER)).thenReturn(Optional.empty());

        AuthorizationResult result = service.authorize(command("50.00"));

        assertThat(result.authorizationId()).isNotBlank();
        assertThat(result.responseCode()).isEqualTo("00");
        assertThat(result.reasonCode()).isEqualTo("0000");
        assertThat(result.approvedAmount()).isEqualByComparingTo("50.00");
        assertThat(result.accountId()).isEqualTo(ACCOUNT_ID);
        assertThat(result.customerId()).isEqualTo(CUSTOMER_ID);
        assertThat(result.fraudFlag()).isEqualTo("N");
        assertThat(result.authTimestamp()).isEqualTo(LocalDateTime.of(2026, 10, 25, 10, 15));

        ArgumentCaptor<AuthorizationCase> detailCaptor = ArgumentCaptor.forClass(AuthorizationCase.class);
        verify(authorizations).saveAuthorization(detailCaptor.capture());
        AuthorizationCase detail = detailCaptor.getValue();
        assertThat(detail.getResponseCode()).isEqualTo("00");
        assertThat(detail.getTransactionAmount()).isEqualByComparingTo("50.00");
        assertThat(detail.getCreatedAt()).isNotNull();

        ArgumentCaptor<AuthorizationSummary> summaryCaptor = ArgumentCaptor.forClass(AuthorizationSummary.class);
        verify(summaries).saveSummary(summaryCaptor.capture());
        AuthorizationSummary saved = summaryCaptor.getValue();
        assertThat(saved.getCreditLimit()).isEqualByComparingTo("2020.00");
        assertThat(saved.getCashLimit()).isEqualByComparingTo("1020.00");
        assertThat(saved.getApprovedCount()).isEqualTo(1);
        assertThat(saved.getApprovedAmount()).isEqualByComparingTo("50.00");
        assertThat(saved.getCreditBalance()).isEqualByComparingTo("50.00");
        assertThat(saved.getDeclinedCount()).isZero();
        assertThat(saved.getDeclinedAmount()).isEqualByComparingTo("0.00");
    }

    @Test
    void declinesInsufficientFundsAndCountsDeclinedAmount() {
        stubExistingCardAndParties();
        when(summaries.findSummary(ACCOUNT_ID)).thenReturn(Optional.empty());
        when(fraudFlags.findFlag(CARD_NUMBER)).thenReturn(Optional.empty());

        AuthorizationResult result = service.authorize(command("500.00"));

        assertThat(result.responseCode()).isEqualTo("05");
        assertThat(result.reasonCode()).isEqualTo("4100");
        assertThat(result.approvedAmount()).isEqualByComparingTo("0.00");

        ArgumentCaptor<AuthorizationSummary> summaryCaptor = ArgumentCaptor.forClass(AuthorizationSummary.class);
        verify(summaries).saveSummary(summaryCaptor.capture());
        AuthorizationSummary saved = summaryCaptor.getValue();
        assertThat(saved.getDeclinedCount()).isEqualTo(1);
        assertThat(saved.getDeclinedAmount()).isEqualByComparingTo("500.00");
        assertThat(saved.getApprovedCount()).isZero();
        assertThat(saved.getCreditBalance()).isEqualByComparingTo("0.00");
    }

    @Test
    void updatesExistingSummaryInPlace() {
        when(cardClient.findCard(CARD_NUMBER)).thenReturn(Optional.of(card));
        when(customerClient.findCustomer(CUSTOMER_ID)).thenReturn(Optional.of(customer));
        when(accountClient.findAccount(ACCOUNT_ID)).thenReturn(Optional.of(new AccountSnapshot(
                ACCOUNT_ID, "Y", new BigDecimal("0.00"), new BigDecimal("2020.00"),
                new BigDecimal("1020.00"))));
        AuthorizationSummary existing = new AuthorizationSummary(ACCOUNT_ID, new BigDecimal("2020.00"),
                new BigDecimal("1020.00"));
        existing.applyApproved(new BigDecimal("1000.00"));
        when(summaries.findSummary(ACCOUNT_ID)).thenReturn(Optional.of(existing));
        when(fraudFlags.findFlag(CARD_NUMBER)).thenReturn(Optional.empty());

        AuthorizationResult result = service.authorize(command("120.00"));

        assertThat(result.responseCode()).isEqualTo("00");
        assertThat(existing.getApprovedCount()).isEqualTo(2);
        assertThat(existing.getApprovedAmount()).isEqualByComparingTo("1120.00");
        assertThat(existing.getCreditBalance()).isEqualByComparingTo("1120.00");
        verify(summaries).saveSummary(existing);
    }

    @Test
    void doesNotPersistWhenCardDoesNotExist() {
        when(cardClient.findCard(CARD_NUMBER)).thenReturn(Optional.empty());

        AuthorizationResult result = service.authorize(command("100.00"));

        assertThat(result.responseCode()).isEqualTo("05");
        assertThat(result.reasonCode()).isEqualTo("3100");
        assertThat(result.approvedAmount()).isEqualByComparingTo("0.00");
        assertThat(result.accountId()).isNull();
        assertThat(result.customerId()).isNull();
        verifyNoInteractions(authorizations);
        verifyNoInteractions(summaries);
    }

    @Test
    void persistsDetailButSkipsSummaryWhenAccountDoesNotExist() {
        when(cardClient.findCard(CARD_NUMBER)).thenReturn(Optional.of(card));
        when(customerClient.findCustomer(CUSTOMER_ID)).thenReturn(Optional.of(customer));
        when(accountClient.findAccount(ACCOUNT_ID)).thenReturn(Optional.empty());

        AuthorizationResult result = service.authorize(command("100.00"));

        assertThat(result.responseCode()).isEqualTo("05");
        assertThat(result.reasonCode()).isEqualTo("3100");
        assertThat(result.accountId()).isEqualTo(ACCOUNT_ID);
        assertThat(result.customerId()).isEqualTo(CUSTOMER_ID);

        ArgumentCaptor<AuthorizationCase> detailCaptor = ArgumentCaptor.forClass(AuthorizationCase.class);
        verify(authorizations).saveAuthorization(detailCaptor.capture());
        assertThat(detailCaptor.getValue().getResponseCode()).isEqualTo("05");
        assertThat(detailCaptor.getValue().getAccountId()).isEqualTo(ACCOUNT_ID);
        verify(summaries, never()).saveSummary(any());
    }

    @Test
    void marksFraudOnDetailAndCardFlagIdempotently() {
        AuthorizationCase existing = new AuthorizationCase(new AuthorizationRequest(CARD_NUMBER,
                LocalDateTime.of(2026, 10, 25, 10, 15), new BigDecimal("120.00"), "01", "2805", "0100",
                "POS", "000000", "5411", "USA", 5, "MERCHANT0000001", "Corner Grocery", "Springfield",
                "IL", "62704", "TXN000000000001", ACCOUNT_ID, CUSTOMER_ID));
        existing.decide("00", "0000", new BigDecimal("120.00"));
        when(authorizations.findAuthorization(existing.getAuthorizationId())).thenReturn(Optional.of(existing));

        AtomicReference<CardFraudFlag> stored = new AtomicReference<>();
        when(fraudFlags.findFlag(CARD_NUMBER)).thenAnswer(invocation -> Optional.ofNullable(stored.get()));
        when(fraudFlags.saveFlag(any())).thenAnswer(invocation -> {
            CardFraudFlag flag = invocation.getArgument(0);
            stored.set(flag);
            return flag;
        });

        FraudResult first = service.markFraud(existing.getAuthorizationId());
        FraudResult second = service.markFraud(existing.getAuthorizationId());

        assertThat(first.fraudFlag()).isEqualTo("Y");
        assertThat(first.cardNumber()).isEqualTo(CARD_NUMBER);
        assertThat(first.cardBlocked()).isTrue();
        assertThat(second).isEqualTo(first);
        assertThat(existing.getFraudFlag()).isEqualTo("Y");
        assertThat(stored.get().getAuthorizationId()).isEqualTo(existing.getAuthorizationId());
        assertThat(stored.get().getReason())
                .isEqualTo("Marked fraud from authorization " + existing.getAuthorizationId());
        verify(fraudFlags, times(2)).saveFlag(any());
    }
}
