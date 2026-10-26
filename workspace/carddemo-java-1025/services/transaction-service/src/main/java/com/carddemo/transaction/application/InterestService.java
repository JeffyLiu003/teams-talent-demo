package com.carddemo.transaction.application;

import com.carddemo.transaction.domain.model.AccountSnapshot;
import com.carddemo.transaction.domain.model.CardSnapshot;
import com.carddemo.transaction.domain.model.DisclosureGroup;
import com.carddemo.transaction.domain.model.TranCategoryBalance;
import com.carddemo.transaction.domain.model.TransactionRecord;
import com.carddemo.transaction.domain.model.TransactionStatus;
import com.carddemo.transaction.domain.repository.DisclosureGroupRepository;
import com.carddemo.transaction.domain.repository.TranCategoryBalanceRepository;
import com.carddemo.transaction.domain.repository.TransactionRepository;
import com.carddemo.transaction.domain.service.InterestCalculator;
import com.carddemo.transaction.infrastructure.client.AccountClient;
import com.carddemo.transaction.infrastructure.client.CardClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * 利息运行（CBACT04C）：按账户汇总各类别月利息，生成一笔利息交易并调账户利息入账。
 * 利率取自披露组（账户组 + 类型 + 类别），缺失回退 DEFAULT（BR-INT-02）；利率为 0 跳过（BR-INT-03）。
 */
@Service
@Transactional
public class InterestService {

    private static final String DEFAULT_GROUP_ID = "DEFAULT";
    private static final String INTEREST_TYPE_CODE = "01";
    private static final String INTEREST_CATEGORY_CODE = "0005";
    private static final String INTEREST_SOURCE = "System";
    private static final String INTEREST_MERCHANT_ID = "000000000";
    private static final String INTEREST_MERCHANT_NAME = "INTEREST";
    private static final String NOT_AVAILABLE = "N/A";
    private static final BigDecimal ZERO = new BigDecimal("0.00");

    private final TranCategoryBalanceRepository balances;
    private final DisclosureGroupRepository disclosureGroups;
    private final TransactionRepository transactions;
    private final TransactionIdGenerator idGenerator;
    private final InterestCalculator interestCalculator;
    private final AccountClient accountClient;
    private final CardClient cardClient;

    public InterestService(TranCategoryBalanceRepository balances,
                           DisclosureGroupRepository disclosureGroups,
                           TransactionRepository transactions,
                           TransactionIdGenerator idGenerator,
                           InterestCalculator interestCalculator,
                           AccountClient accountClient,
                           CardClient cardClient) {
        this.balances = balances;
        this.disclosureGroups = disclosureGroups;
        this.transactions = transactions;
        this.idGenerator = idGenerator;
        this.interestCalculator = interestCalculator;
        this.accountClient = accountClient;
        this.cardClient = cardClient;
    }

    public InterestRunResult run(LocalDate statementDate) {
        LocalDate runDate = statementDate == null ? LocalDate.now() : statementDate;
        List<String> accountIds = balances.findDistinctAccountIds();
        List<InterestDetail> details = new ArrayList<>();
        int interestPosted = 0;
        BigDecimal totalInterest = ZERO;

        for (String accountId : accountIds) {
            Optional<AccountSnapshot> accountSnapshot = accountClient.findAccount(accountId);
            if (accountSnapshot.isEmpty()) {
                continue;
            }
            AccountSnapshot account = accountSnapshot.get();
            BigDecimal accountInterest = ZERO;
            for (TranCategoryBalance balance : balances.findByAccountId(accountId)) {
                BigDecimal rate = interestRate(account.groupId(), balance.getTypeCode(), balance.getCategoryCode());
                if (rate.signum() == 0) {
                    continue;
                }
                accountInterest = accountInterest.add(
                        interestCalculator.monthlyInterest(balance.getBalance(), rate));
            }
            if (accountInterest.signum() <= 0) {
                continue;
            }

            String cardNumber = firstCardNumber(accountId);
            LocalDateTime now = LocalDateTime.now();
            TransactionRecord record = new TransactionRecord(
                    idGenerator.nextForDate(runDate),
                    accountId,
                    cardNumber,
                    INTEREST_TYPE_CODE,
                    INTEREST_CATEGORY_CODE,
                    INTEREST_SOURCE,
                    "Int. for a/c " + accountId,
                    accountInterest,
                    INTEREST_MERCHANT_ID,
                    INTEREST_MERCHANT_NAME,
                    NOT_AVAILABLE,
                    NOT_AVAILABLE,
                    now,
                    now,
                    TransactionStatus.POSTED);
            accountClient.accrueInterest(accountId, accountInterest);
            transactions.saveTransaction(record);

            interestPosted++;
            totalInterest = totalInterest.add(accountInterest);
            details.add(new InterestDetail(accountId, accountInterest));
        }

        return new InterestRunResult(runDate, accountIds.size(), interestPosted, totalInterest, details);
    }

    private BigDecimal interestRate(String groupId, String typeCode, String categoryCode) {
        Optional<DisclosureGroup> group = groupId == null || groupId.isBlank()
                ? Optional.empty()
                : disclosureGroups.find(groupId, typeCode, categoryCode);
        return group.or(() -> disclosureGroups.find(DEFAULT_GROUP_ID, typeCode, categoryCode))
                .map(DisclosureGroup::getInterestRate)
                .orElse(ZERO);
    }

    private String firstCardNumber(String accountId) {
        List<CardSnapshot> cards = cardClient.findCardsByAccount(accountId);
        return cards.stream()
                .min(Comparator.comparing(CardSnapshot::cardNumber))
                .map(CardSnapshot::cardNumber)
                .orElse(null);
    }
}
