package com.carddemo.transaction.application;

import com.carddemo.transaction.domain.exception.BusinessRuleException;
import com.carddemo.transaction.domain.exception.NotFoundException;
import com.carddemo.transaction.domain.model.AccountSnapshot;
import com.carddemo.transaction.domain.model.CardSnapshot;
import com.carddemo.transaction.domain.model.TransactionRecord;
import com.carddemo.transaction.domain.model.TransactionStatus;
import com.carddemo.transaction.domain.repository.TransactionRepository;
import com.carddemo.transaction.infrastructure.client.AccountClient;
import com.carddemo.transaction.infrastructure.client.CardClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

/**
 * 账单支付用例（COBIL00C）：金额恒等于当前余额，先在本地落 PENDING，账户扣款成功后置 POSTED（ADR-005）。
 */
@Service
@Transactional
public class BillPaymentService {

    private static final String PAYMENT_TYPE_CODE = "02";
    private static final String PAYMENT_CATEGORY_CODE = "0002";
    private static final String PAYMENT_SOURCE = "POS TERM";
    private static final String PAYMENT_DESCRIPTION = "BILL PAYMENT - ONLINE";
    private static final String PAYMENT_MERCHANT_ID = "999999999";
    private static final String PAYMENT_MERCHANT_NAME = "BILL PAYMENT";
    private static final String NOT_AVAILABLE = "N/A";

    private final TransactionRepository transactions;
    private final TransactionIdGenerator idGenerator;
    private final AccountClient accountClient;
    private final CardClient cardClient;

    public BillPaymentService(TransactionRepository transactions,
                              TransactionIdGenerator idGenerator,
                              AccountClient accountClient,
                              CardClient cardClient) {
        this.transactions = transactions;
        this.idGenerator = idGenerator;
        this.accountClient = accountClient;
        this.cardClient = cardClient;
    }

    public BillPaymentResult pay(String accountId, boolean confirm) {
        if (!confirm) {
            throw new BusinessRuleException("CONFIRMATION_REQUIRED",
                    "Please confirm the bill payment before proceeding.");
        }
        AccountSnapshot account = accountClient.findAccount(accountId)
                .orElseThrow(() -> new NotFoundException("ACCOUNT_NOT_FOUND",
                        "Account " + accountId + " not found"));

        BigDecimal amount = account.currentBalance() == null ? new BigDecimal("0.00") : account.currentBalance();
        if (amount.signum() <= 0) {
            throw new BusinessRuleException("NOTHING_TO_PAY", "You have nothing to pay...");
        }

        CardSnapshot card = firstCard(accountId);
        LocalDateTime now = LocalDateTime.now();
        TransactionRecord record = new TransactionRecord(idGenerator.next(), accountId, card.cardNumber(),
                PAYMENT_TYPE_CODE, PAYMENT_CATEGORY_CODE, PAYMENT_SOURCE, PAYMENT_DESCRIPTION, amount,
                PAYMENT_MERCHANT_ID, PAYMENT_MERCHANT_NAME, NOT_AVAILABLE, NOT_AVAILABLE, now, now,
                TransactionStatus.PENDING);
        transactions.saveTransaction(record);

        AccountSnapshot updated = accountClient.payBill(accountId, amount);

        record.markPosted();
        transactions.saveTransaction(record);

        return new BillPaymentResult(record.getTransactionId(), amount, updated.currentBalance());
    }

    private CardSnapshot firstCard(String accountId) {
        List<CardSnapshot> cards = cardClient.findCardsByAccount(accountId);
        return cards.stream()
                .min(Comparator.comparing(CardSnapshot::cardNumber))
                .orElseThrow(() -> new BusinessRuleException("BILL_PAYMENT_CARD_NOT_FOUND",
                        "No card found for account " + accountId + "."));
    }
}
