package com.carddemo.transaction.application;

import com.carddemo.transaction.domain.exception.BusinessRuleException;
import com.carddemo.transaction.domain.model.AccountSnapshot;
import com.carddemo.transaction.domain.model.CardSnapshot;
import com.carddemo.transaction.domain.model.TransactionRecord;
import com.carddemo.transaction.domain.model.TransactionStatus;
import com.carddemo.transaction.domain.repository.TransactionRepository;
import com.carddemo.transaction.infrastructure.client.AccountClient;
import com.carddemo.transaction.infrastructure.client.CardClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 账单支付用例：BR-BILL-01（无欠款拒绝）、BR-BILL-03/04（全额还款并落交易）、BR-BILL-05（下游成功才 POSTED）。
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class BillPaymentServiceTest {

    private static final String ACCOUNT_ID = "00000000002";

    @Autowired
    private BillPaymentService billPaymentService;

    @Autowired
    private TransactionRepository transactions;

    @MockBean
    private AccountClient accountClient;

    @MockBean
    private CardClient cardClient;

    private final CardSnapshot card = new CardSnapshot("0683586198171516", ACCOUNT_ID, "000000002",
            "ENRICO ROSENBAUM", LocalDate.of(2029, 8, 11), "Y");

    private AccountSnapshot account(String balance) {
        return new AccountSnapshot(ACCOUNT_ID, "Y", new BigDecimal(balance), new BigDecimal("6130.00"),
                new BigDecimal("5448.00"), new BigDecimal("0.00"), new BigDecimal("0.00"),
                LocalDate.of(2024, 8, 11), "A000000000");
    }

    @Test
    void rejectsAccountWithNothingToPay() {
        when(accountClient.findAccount(ACCOUNT_ID)).thenReturn(Optional.of(account("0.00")));

        assertThatThrownBy(() -> billPaymentService.pay(ACCOUNT_ID, true))
                .isInstanceOf(BusinessRuleException.class)
                .extracting("code").isEqualTo("NOTHING_TO_PAY");
        verify(accountClient, never()).payBill(any(), any());
    }

    @Test
    void paysOutstandingBalanceAndPersistsPostedTransaction() {
        when(accountClient.findAccount(ACCOUNT_ID)).thenReturn(Optional.of(account("1580.00")));
        when(cardClient.findCardsByAccount(ACCOUNT_ID)).thenReturn(List.of(card));
        when(accountClient.payBill(ACCOUNT_ID, new BigDecimal("1580.00"))).thenReturn(account("0.00"));

        BillPaymentResult result = billPaymentService.pay(ACCOUNT_ID, true);

        assertThat(result.amount()).isEqualByComparingTo("1580.00");
        assertThat(result.newBalance()).isEqualByComparingTo("0.00");
        assertThat(result.transactionId()).hasSize(16);
        verify(accountClient).payBill(ACCOUNT_ID, new BigDecimal("1580.00"));

        TransactionRecord saved = transactions.findByTransactionId(result.transactionId()).orElseThrow();
        assertThat(saved.getStatus()).isEqualTo(TransactionStatus.POSTED);
        assertThat(saved.getAccountId()).isEqualTo(ACCOUNT_ID);
        assertThat(saved.getCardNumber()).isEqualTo("0683586198171516");
        assertThat(saved.getTypeCode()).isEqualTo("02");
        assertThat(saved.getCategoryCode()).isEqualTo("0002");
        assertThat(saved.getSource()).isEqualTo("POS TERM");
        assertThat(saved.getDescription()).isEqualTo("BILL PAYMENT - ONLINE");
        assertThat(saved.getAmount()).isEqualByComparingTo("1580.00");
        assertThat(saved.getMerchantId()).isEqualTo("999999999");
        assertThat(saved.getMerchantName()).isEqualTo("BILL PAYMENT");
        assertThat(saved.getMerchantCity()).isEqualTo("N/A");
        assertThat(saved.getMerchantZip()).isEqualTo("N/A");
    }

    @Test
    void requiresExplicitConfirmation() {
        assertThatThrownBy(() -> billPaymentService.pay(ACCOUNT_ID, false))
                .isInstanceOf(BusinessRuleException.class)
                .extracting("code").isEqualTo("CONFIRMATION_REQUIRED");
        verify(accountClient, never()).findAccount(any());
        verify(accountClient, never()).payBill(any(), any());
    }

    @Test
    void propagatesDownstreamPaymentFailure() {
        when(accountClient.findAccount(ACCOUNT_ID)).thenReturn(Optional.of(account("1580.00")));
        when(cardClient.findCardsByAccount(ACCOUNT_ID)).thenReturn(List.of(card));
        when(accountClient.payBill(ACCOUNT_ID, new BigDecimal("1580.00")))
                .thenThrow(new BusinessRuleException("NOTHING_TO_PAY", "You have nothing to pay..."));

        assertThatThrownBy(() -> billPaymentService.pay(ACCOUNT_ID, true))
                .isInstanceOf(BusinessRuleException.class)
                .extracting("code").isEqualTo("NOTHING_TO_PAY");
    }
}
