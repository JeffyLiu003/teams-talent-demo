package com.carddemo.transaction.application;

import com.carddemo.transaction.domain.exception.InvalidRequestException;
import com.carddemo.transaction.domain.exception.NotFoundException;
import com.carddemo.transaction.domain.model.AccountSnapshot;
import com.carddemo.transaction.domain.model.CardSnapshot;
import com.carddemo.transaction.domain.model.TransactionRecord;
import com.carddemo.transaction.domain.model.TransactionStatus;
import com.carddemo.transaction.domain.repository.PageResult;
import com.carddemo.transaction.domain.repository.TranCategoryRepository;
import com.carddemo.transaction.domain.repository.TranTypeRepository;
import com.carddemo.transaction.domain.repository.TransactionFilter;
import com.carddemo.transaction.domain.repository.TransactionRepository;
import com.carddemo.transaction.infrastructure.client.AccountClient;
import com.carddemo.transaction.infrastructure.client.CardClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.stream.Collectors;

/**
 * 交易录入与查询用例。对应遗留 COTRN00C（列表）、COTRN01C（详情）、COTRN02C（录入）。
 */
@Service
@Transactional
public class TransactionApplicationService {

    private static final int DEFAULT_PAGE_SIZE = 10;

    private final TransactionRepository transactions;
    private final TransactionIdGenerator idGenerator;
    private final CardClient cardClient;
    private final AccountClient accountClient;
    private final TranTypeRepository types;
    private final TranCategoryRepository categories;

    public TransactionApplicationService(TransactionRepository transactions,
                                         TransactionIdGenerator idGenerator,
                                         CardClient cardClient,
                                         AccountClient accountClient,
                                         TranTypeRepository types,
                                         TranCategoryRepository categories) {
        this.transactions = transactions;
        this.idGenerator = idGenerator;
        this.cardClient = cardClient;
        this.accountClient = accountClient;
        this.types = types;
        this.categories = categories;
    }

    /**
     * BR-TRN-09：按交易号升序分页，可按交易号前缀过滤。
     */
    @Transactional(readOnly = true)
    public PageResult<TransactionView> list(String idPrefix, String cardNumber, String accountId,
                                           int page, int size) {
        TransactionFilter filter = new TransactionFilter(trimToNull(idPrefix), trimToNull(cardNumber),
                trimToNull(accountId), null, null);
        PageResult<TransactionRecord> result = transactions.search(filter,
                Math.max(page, 0), size <= 0 ? DEFAULT_PAGE_SIZE : size);
        Map<String, String> typeDescriptions = typeDescriptions();
        Map<String, String> categoryDescriptions = categoryDescriptions();
        return new PageResult<>(result.items().stream()
                .map(record -> toView(record, typeDescriptions, categoryDescriptions))
                .toList(), result.total());
    }

    @Transactional(readOnly = true)
    public TransactionView get(String transactionId) {
        TransactionRecord record = transactions.findByTransactionId(transactionId)
                .orElseThrow(() -> new NotFoundException("TRANSACTION_NOT_FOUND",
                        "Transaction " + transactionId + " not found"));
        return toView(record, typeDescriptions(), categoryDescriptions());
    }

    /**
     * BR-TRN-01/02/07/08：录入交易。卡号存在时以卡号解析账户并校验一致性；交易号 = 当前最大 + 1。
     */
    public TransactionView create(CreateTransactionCommand command) {
        String cardNumber = trimToNull(command.cardNumber());
        String accountId = trimToNull(command.accountId());
        if (accountId == null && cardNumber == null) {
            throw new InvalidRequestException("ACCOUNT_OR_CARD_REQUIRED",
                    "Account number or card number is required.");
        }
        if (cardNumber != null) {
            CardSnapshot card = cardClient.findCard(cardNumber)
                    .orElseThrow(() -> new NotFoundException("CARD_NOT_FOUND",
                            "Card " + mask(cardNumber) + " not found"));
            if (accountId != null && !accountId.equals(card.accountId())) {
                throw new InvalidRequestException("CARD_ACCOUNT_MISMATCH",
                        "Card " + mask(cardNumber) + " does not belong to account " + accountId + ".");
            }
            accountId = card.accountId();
        }
        String resolvedAccountId = accountId;
        AccountSnapshot account = accountClient.findAccount(resolvedAccountId)
                .orElseThrow(() -> new NotFoundException("ACCOUNT_NOT_FOUND",
                        "Account " + resolvedAccountId + " not found"));

        TransactionRecord record = new TransactionRecord(
                idGenerator.next(),
                account.accountId(),
                cardNumber,
                command.typeCode(),
                command.categoryCode(),
                command.source(),
                command.description(),
                command.amount(),
                command.merchantId(),
                command.merchantName(),
                command.merchantCity(),
                command.merchantZip(),
                command.originalDate().atStartOfDay(),
                command.processedDate().atStartOfDay(),
                TransactionStatus.POSTED);
        transactions.saveTransaction(record);
        return toView(record, typeDescriptions(), categoryDescriptions());
    }

    private TransactionView toView(TransactionRecord record, Map<String, String> typeDescriptions,
                                   Map<String, String> categoryDescriptions) {
        return new TransactionView(record,
                typeDescriptions.get(record.getTypeCode()),
                categoryDescriptions.get(categoryKey(record.getTypeCode(), record.getCategoryCode())));
    }

    private Map<String, String> typeDescriptions() {
        return types.findAllTypes().stream()
                .collect(Collectors.toMap(type -> type.getTypeCode(), type -> type.getDescription(),
                        (left, right) -> left));
    }

    private Map<String, String> categoryDescriptions() {
        return categories.findAllCategories().stream()
                .collect(Collectors.toMap(category -> categoryKey(category.getTypeCode(), category.getCategoryCode()),
                        category -> category.getDescription(), (left, right) -> left));
    }

    static String categoryKey(String typeCode, String categoryCode) {
        return typeCode + "/" + categoryCode;
    }

    static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    static String mask(String cardNumber) {
        if (cardNumber == null || cardNumber.length() < 4) {
            return "****";
        }
        return "****" + cardNumber.substring(cardNumber.length() - 4);
    }
}
