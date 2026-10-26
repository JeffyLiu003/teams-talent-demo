package com.carddemo.transaction.application;

import com.carddemo.transaction.domain.model.AccountSnapshot;
import com.carddemo.transaction.domain.model.CardSnapshot;
import com.carddemo.transaction.domain.model.TranCategoryBalance;
import com.carddemo.transaction.domain.repository.TranCategoryBalanceRepository;
import com.carddemo.transaction.domain.repository.TransactionRepository;
import com.carddemo.transaction.infrastructure.client.AccountClient;
import com.carddemo.transaction.infrastructure.client.CardClient;
import com.carddemo.transaction.infrastructure.client.MarketingClient;
import com.carddemo.transaction.domain.exception.RemoteServiceException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 入账用例：下游服务用 Mockito 替换，本地交易库为真实 H2 + Flyway 种子。
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PostingServiceTest {

    private static final String CARD_NUMBER = "0500024453765740";
    private static final String ACCOUNT_ID = "00000000001";

    @Autowired
    private PostingService postingService;

    @Autowired
    private TransactionRepository transactions;

    @Autowired
    private TranCategoryBalanceRepository balances;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockBean
    private CardClient cardClient;

    @MockBean
    private AccountClient accountClient;

    @MockBean
    private MarketingClient marketingClient;

    private final CardSnapshot card = new CardSnapshot(CARD_NUMBER, ACCOUNT_ID, "000000001",
            "IMMANUEL KESSLER", LocalDate.of(2028, 5, 20), "Y");

    private AccountSnapshot account(String creditLimit) {
        return new AccountSnapshot(ACCOUNT_ID, "Y", new BigDecimal("1940.00"),
                new BigDecimal(creditLimit), new BigDecimal("1020.00"), new BigDecimal("0.00"),
                new BigDecimal("0.00"), LocalDate.of(2028, 5, 20), "A000000000");
    }

    private PostingCommand command(String transactionId, String amount) {
        return new PostingCommand(transactionId, CARD_NUMBER, "01", "0001", "POS TERM",
                "Purchase at Merchant A", new BigDecimal(amount),
                LocalDateTime.of(2026, 10, 25, 10, 15), "800000001", "Merchant A", "Springfield", "10001");
    }

    @Test
    void postedTransactionAccumulatesCategoryBalanceAndCallsAccountService() {
        when(cardClient.findCard(CARD_NUMBER)).thenReturn(Optional.of(card));
        when(accountClient.findAccount(ACCOUNT_ID)).thenReturn(Optional.of(account("5000.00")));
        when(accountClient.applyPosting(eq(ACCOUNT_ID), any())).thenReturn(account("5000.00"));

        PostingResult result = postingService.post(List.of(command("0000000000000100", "75.00")));

        assertThat(result.status()).isEqualTo("COMPLETED");
        assertThat(result.processed()).isEqualTo(1);
        assertThat(result.posted()).isEqualTo(1);
        assertThat(result.rejected()).isZero();
        assertThat(result.rejections()).isEmpty();

        verify(accountClient).applyPosting(ACCOUNT_ID, new BigDecimal("75.00"));
        verify(marketingClient).evaluateRewards(any());
        assertThat(transactions.findByTransactionId("0000000000000100")).isPresent();
        assertThat(balances.find(ACCOUNT_ID, "01", "0001")).get()
                .extracting(TranCategoryBalance::getBalance)
                .isEqualTo(new BigDecimal("1275.00"));
        assertThat(dailyStatus("0000000000000100")).isEqualTo("POSTED");
        assertThat(rejectReasonCode("0000000000000100")).isNull();
    }

    @Test
    void marketingFailureDoesNotFailPosting() {
        when(cardClient.findCard(CARD_NUMBER)).thenReturn(Optional.of(card));
        when(accountClient.findAccount(ACCOUNT_ID)).thenReturn(Optional.of(account("5000.00")));
        when(accountClient.applyPosting(eq(ACCOUNT_ID), any())).thenReturn(account("5000.00"));
        doThrow(new RemoteServiceException("marketing down"))
                .when(marketingClient).evaluateRewards(any());

        PostingResult result = postingService.post(List.of(command("0000000000000103", "30.00")));

        assertThat(result.status()).isEqualTo("COMPLETED");
        assertThat(result.posted()).isEqualTo(1);
        assertThat(transactions.findByTransactionId("0000000000000103")).isPresent();
    }

    @Test
    void overlimitTransactionIsRejectedWithoutTouchingDownstreamPostings() {
        when(cardClient.findCard(CARD_NUMBER)).thenReturn(Optional.of(card));
        when(accountClient.findAccount(ACCOUNT_ID)).thenReturn(Optional.of(account("2020.00")));

        PostingResult result = postingService.post(List.of(command("0000000000000101", "5000.00")));

        assertThat(result.status()).isEqualTo("COMPLETED_WITH_REJECTS");
        assertThat(result.posted()).isZero();
        assertThat(result.rejected()).isEqualTo(1);
        assertThat(result.rejections()).singleElement().satisfies(rejection -> {
            assertThat(rejection.transactionId()).isEqualTo("0000000000000101");
            assertThat(rejection.reasonCode()).isEqualTo(102);
            assertThat(rejection.reason()).isEqualTo("OVERLIMIT TRANSACTION");
        });

        verify(accountClient, never()).applyPosting(any(), any());
        assertThat(transactions.findByTransactionId("0000000000000101")).isEmpty();
        assertThat(dailyStatus("0000000000000101")).isEqualTo("REJECTED");
        assertThat(rejectReasonCode("0000000000000101")).isEqualTo(102);
        assertThat(jdbcTemplate.queryForObject(
                "select reject_reason from daily_transaction where transaction_id = ?", String.class,
                "0000000000000101")).isEqualTo("OVERLIMIT TRANSACTION");
        assertThat(balances.find(ACCOUNT_ID, "01", "0001")).get()
                .extracting(TranCategoryBalance::getBalance)
                .isEqualTo(new BigDecimal("1200.00"));
    }

    @Test
    void unknownCardIsRejectedWithoutCallingAccountService() {
        when(cardClient.findCard(CARD_NUMBER)).thenReturn(Optional.empty());

        PostingResult result = postingService.post(List.of(command("0000000000000102", "10.00")));

        assertThat(result.rejected()).isEqualTo(1);
        assertThat(result.rejections()).singleElement()
                .extracting("reasonCode").isEqualTo(100);
        verify(accountClient, never()).findAccount(any());
        verify(accountClient, never()).applyPosting(any(), any());
    }

    @Test
    void duplicateTransactionIdIsIdempotent() {
        when(cardClient.findCard(CARD_NUMBER)).thenReturn(Optional.of(card));
        when(accountClient.findAccount(ACCOUNT_ID)).thenReturn(Optional.of(account("5000.00")));
        when(accountClient.applyPosting(eq(ACCOUNT_ID), any())).thenReturn(account("5000.00"));

        PostingResult first = postingService.post(List.of(command("0000000000000103", "75.00")));
        PostingResult second = postingService.post(List.of(command("0000000000000103", "75.00")));

        assertThat(first.posted()).isEqualTo(1);
        assertThat(first.duplicates()).isEmpty();
        assertThat(second.posted()).isEqualTo(1);
        assertThat(second.rejected()).isZero();
        assertThat(second.duplicates()).containsExactly("0000000000000103");
        assertThat(balances.find(ACCOUNT_ID, "01", "0001")).get()
                .extracting(TranCategoryBalance::getBalance)
                .isEqualTo(new BigDecimal("1275.00"));
        verify(accountClient).applyPosting(ACCOUNT_ID, new BigDecimal("75.00"));
    }

    private String dailyStatus(String transactionId) {
        return jdbcTemplate.queryForObject(
                "select status from daily_transaction where transaction_id = ?", String.class, transactionId);
    }

    private Integer rejectReasonCode(String transactionId) {
        return jdbcTemplate.queryForObject(
                "select reject_reason_code from daily_transaction where transaction_id = ?",
                Integer.class, transactionId);
    }
}
