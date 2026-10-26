package com.carddemo.authorization.application;

import com.carddemo.authorization.domain.exception.InvalidRequestException;
import com.carddemo.authorization.domain.exception.NotFoundException;
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
import com.carddemo.authorization.domain.repository.PageResult;
import com.carddemo.authorization.domain.service.AuthorizationPolicy;
import com.carddemo.authorization.infrastructure.client.AccountClient;
import com.carddemo.authorization.infrastructure.client.CardClient;
import com.carddemo.authorization.infrastructure.client.CustomerClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * 授权用例编排。对应遗留 COPAUA0C（决策）、COPAUS0C/1C/2C（查询与欺诈标记）、CBPAUP0C（过期清理）。
 */
@Service
@Transactional
public class AuthorizationService {

    static final int DEFAULT_PAGE_SIZE = 10;
    static final int MAX_PAGE_SIZE = 100;
    static final int DEFAULT_EXPIRY_DAYS = 5;

    private static final BigDecimal ZERO = new BigDecimal("0.00");

    private final AuthorizationRepository authorizations;
    private final AuthorizationSummaryRepository summaries;
    private final CardFraudFlagRepository fraudFlags;
    private final CardClient cardClient;
    private final AccountClient accountClient;
    private final CustomerClient customerClient;
    private final AuthorizationPolicy policy;

    public AuthorizationService(AuthorizationRepository authorizations,
                                AuthorizationSummaryRepository summaries,
                                CardFraudFlagRepository fraudFlags,
                                CardClient cardClient,
                                AccountClient accountClient,
                                CustomerClient customerClient,
                                AuthorizationPolicy policy) {
        this.authorizations = authorizations;
        this.summaries = summaries;
        this.fraudFlags = fraudFlags;
        this.cardClient = cardClient;
        this.accountClient = accountClient;
        this.customerClient = customerClient;
        this.policy = policy;
    }

    /**
     * BR-AUTH-01..11：授权决策并落明细/汇总。下游不可用抛 {@code RemoteServiceException}（失败关闭，不批准）。
     */
    public AuthorizationResult authorize(AuthorizationCommand command) {
        if (command.transactionAmount() == null || command.transactionAmount().signum() <= 0) {
            throw new InvalidRequestException("VALIDATION_FAILED",
                    "Transaction Amount must be greater than zero.");
        }
        LocalDateTime authTimestamp = command.authTimestamp() == null
                ? LocalDateTime.now()
                : command.authTimestamp();

        Optional<CardSnapshot> found = cardClient.findCard(command.cardNumber());
        if (found.isEmpty()) {
            // COPAUA0C 463-465：卡号不存在只回应拒绝，不写授权明细
            return new AuthorizationResult(UUID.randomUUID().toString(), command.cardNumber(),
                    command.transactionId(), authTimestamp, AuthorizationCase.DECLINED,
                    AuthorizationPolicy.REASON_NOT_FOUND, ZERO, null, null, AuthorizationCase.FRAUD_CLEAR);
        }
        CardSnapshot card = found.get();
        CustomerSnapshot customer = findCustomer(card.customerId());
        AccountSnapshot account = findAccount(card.accountId());

        AuthorizationCase authorization = new AuthorizationCase(
                requestOf(command, card, authTimestamp));
        if (customer == null || account == null) {
            // BR-AUTH-02：客户/账户不存在仍写明细，但不更新汇总
            authorization.decide(AuthorizationCase.DECLINED, AuthorizationPolicy.REASON_NOT_FOUND, ZERO);
            authorizations.saveAuthorization(authorization);
            return AuthorizationResult.from(authorization);
        }

        AuthorizationSummary summary = summaries.findSummary(card.accountId()).orElse(null);
        boolean fraudFlagged = fraudFlags.findFlag(card.cardNumber()).isPresent();
        AuthorizationPolicy.Decision decision = policy.decide(card, customer, account, summary,
                fraudFlagged, command.transactionAmount());
        authorization.decide(decision.responseCode(), decision.reasonCode(), decision.approvedAmount());
        authorizations.saveAuthorization(authorization);

        // BR-AUTH-10：账户存在时更新汇总，缺失则以账户额度初始化
        AuthorizationSummary updated = summary == null
                ? new AuthorizationSummary(account.accountId(), account.creditLimit(), account.cashCreditLimit())
                : summary;
        if (authorization.isApproved()) {
            updated.applyApproved(authorization.getApprovedAmount());
        } else {
            updated.applyDeclined(authorization.getTransactionAmount());
        }
        summaries.saveSummary(updated);

        return AuthorizationResult.from(authorization);
    }

    @Transactional(readOnly = true)
    public AuthorizationCase getDetail(String authorizationId) {
        return authorizations.findAuthorization(authorizationId)
                .orElseThrow(() -> new NotFoundException("AUTHORIZATION_NOT_FOUND",
                        "Authorization " + authorizationId + " not found"));
    }

    /**
     * BR-AUTH-12：按账户分页查询授权明细，authTimestamp 倒序。
     */
    @Transactional(readOnly = true)
    public PageResult<AuthorizationCase> list(String accountId, int page, int size) {
        if (page < 0) {
            throw new InvalidRequestException("VALIDATION_FAILED", "Page must not be negative.");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new InvalidRequestException("VALIDATION_FAILED",
                    "Size must be between 1 and " + MAX_PAGE_SIZE + ".");
        }
        return authorizations.findByAccountId(accountId, page, size);
    }

    @Transactional(readOnly = true)
    public AuthorizationSummary getSummary(String accountId) {
        return summaries.findSummary(accountId)
                .orElseThrow(() -> new NotFoundException("AUTHORIZATION_SUMMARY_NOT_FOUND",
                        "No pending authorization summary for account " + accountId));
    }

    /**
     * BR-AUTH-12：对单笔授权标记欺诈，并写入卡级欺诈标记。重复标记幂等。
     */
    public FraudResult markFraud(String authorizationId) {
        AuthorizationCase authorization = getDetail(authorizationId);
        authorization.markFraud();
        authorizations.saveAuthorization(authorization);

        LocalDateTime now = LocalDateTime.now();
        String reason = "Marked fraud from authorization " + authorization.getAuthorizationId();
        CardFraudFlag flag = fraudFlags.findFlag(authorization.getCardNumber()).orElse(null);
        if (flag == null) {
            fraudFlags.saveFlag(new CardFraudFlag(authorization.getCardNumber(), now, reason, authorizationId));
        } else {
            flag.reflag(now, reason, authorizationId);
            fraudFlags.saveFlag(flag);
        }
        return new FraudResult(authorizationId, AuthorizationCase.FRAUD_FLAGGED,
                authorization.getCardNumber(), true);
    }

    /**
     * BR-AUTH-13 + NR-AUTH-01/02：删除 authTimestamp 早于 now − expiryDays 的明细，
     * 按剩余明细重算汇总（信用余额 = 剩余批准金额之和），批准与拒绝笔数均为 0 时删除汇总。
     */
    public PurgeResult purge(Integer expiryDays) {
        int days = expiryDays == null ? DEFAULT_EXPIRY_DAYS : expiryDays;
        LocalDateTime cutoff = LocalDateTime.now().minusDays(days);

        int summariesRead = (int) summaries.countSummaries();
        List<AuthorizationCase> expired = authorizations.findExpired(cutoff);
        int detailsRead = expired.size();
        BigDecimal released = expired.stream()
                .filter(AuthorizationCase::isApproved)
                .map(AuthorizationCase::getApprovedAmount)
                .reduce(ZERO, BigDecimal::add);
        Set<String> affectedAccounts = new LinkedHashSet<>();
        for (AuthorizationCase detail : expired) {
            if (detail.getAccountId() != null) {
                affectedAccounts.add(detail.getAccountId());
            }
        }

        int detailsDeleted = authorizations.deleteExpired(cutoff);

        int summariesDeleted = 0;
        for (String accountId : affectedAccounts) {
            Optional<AuthorizationSummary> found = summaries.findSummary(accountId);
            if (found.isEmpty()) {
                continue;
            }
            AuthorizationSummary summary = found.get();
            int approvedCount = 0;
            int declinedCount = 0;
            BigDecimal approvedAmount = ZERO;
            BigDecimal declinedAmount = ZERO;
            for (AuthorizationCase detail : authorizations.findAllByAccountId(accountId)) {
                if (detail.isApproved()) {
                    approvedCount += 1;
                    approvedAmount = approvedAmount.add(detail.getApprovedAmount());
                } else {
                    declinedCount += 1;
                    declinedAmount = declinedAmount.add(detail.getTransactionAmount());
                }
            }
            summary.recalculateFromDetails(approvedCount, approvedAmount, declinedCount, declinedAmount,
                    approvedAmount);
            if (summary.isEmpty()) {
                summaries.deleteSummary(summary);
                summariesDeleted += 1;
            } else {
                summaries.saveSummary(summary);
            }
        }
        return new PurgeResult(summariesRead, summariesDeleted, detailsRead, detailsDeleted, released);
    }

    private CustomerSnapshot findCustomer(String customerId) {
        if (customerId == null) {
            return null;
        }
        return customerClient.findCustomer(customerId).orElse(null);
    }

    private AccountSnapshot findAccount(String accountId) {
        if (accountId == null) {
            return null;
        }
        return accountClient.findAccount(accountId).orElse(null);
    }

    private static AuthorizationRequest requestOf(AuthorizationCommand command, CardSnapshot card,
                                                  LocalDateTime authTimestamp) {
        return new AuthorizationRequest(
                command.cardNumber(),
                authTimestamp,
                command.transactionAmount(),
                command.authType(),
                command.cardExpiryDate(),
                command.messageType(),
                command.messageSource(),
                command.processingCode(),
                command.merchantCategoryCode(),
                command.acquirerCountryCode(),
                command.posEntryMode(),
                command.merchantId(),
                command.merchantName(),
                command.merchantCity(),
                command.merchantState(),
                command.merchantZip(),
                command.transactionId(),
                card.accountId(),
                card.customerId());
    }
}
