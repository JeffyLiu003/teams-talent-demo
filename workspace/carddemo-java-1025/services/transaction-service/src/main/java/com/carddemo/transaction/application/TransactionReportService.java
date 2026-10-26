package com.carddemo.transaction.application;

import com.carddemo.transaction.domain.exception.BusinessRuleException;
import com.carddemo.transaction.domain.model.TransactionRecord;
import com.carddemo.transaction.domain.repository.TranCategoryRepository;
import com.carddemo.transaction.domain.repository.TranTypeRepository;
import com.carddemo.transaction.domain.repository.TransactionFilter;
import com.carddemo.transaction.domain.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 交易报表（CBTRN03C）。按处理时间戳闭区间过滤（BR-RPT-02），输出页/卡号/总计三级合计（BR-RPT-03），
 * 引用的类型或类别不在参照表中时整份报表失败（BR-RPT-04）。
 */
@Service
@Transactional(readOnly = true)
public class TransactionReportService {

    private static final BigDecimal ZERO = new BigDecimal("0.00");

    private final TransactionRepository transactions;
    private final TranTypeRepository types;
    private final TranCategoryRepository categories;

    public TransactionReportService(TransactionRepository transactions,
                                    TranTypeRepository types,
                                    TranCategoryRepository categories) {
        this.transactions = transactions;
        this.types = types;
        this.categories = categories;
    }

    public TransactionReport report(LocalDate startDate, LocalDate endDate, String cardNumber,
                                    int page, int size) {
        LocalDateTime from = startDate.atStartOfDay();
        LocalDateTime to = endDate.atTime(LocalTime.MAX);
        String cardFilter = TransactionApplicationService.trimToNull(cardNumber);

        List<TransactionRecord> rows = transactions.searchAll(
                new TransactionFilter(null, cardFilter, null, from, to));

        verifyReferences(rows);

        List<TransactionRecord> pageRows = slice(rows, page, size);
        BigDecimal pageTotal = sum(pageRows);

        Map<String, BigDecimal> totalsByCard = new LinkedHashMap<>();
        for (TransactionRecord row : rows) {
            totalsByCard.merge(row.getCardNumber(), row.getAmount(), BigDecimal::add);
        }
        List<CardTotal> accountTotals = totalsByCard.entrySet().stream()
                .map(entry -> new CardTotal(entry.getKey(), entry.getValue()))
                .toList();

        List<TransactionView> items = toViews(pageRows);
        return new TransactionReport(items, page, size, rows.size(), pageTotal, accountTotals, sum(rows));
    }

    private void verifyReferences(List<TransactionRecord> rows) {
        if (rows.isEmpty()) {
            return;
        }
        Map<String, String> typeDescriptions = types.findAllTypes().stream()
                .collect(Collectors.toMap(type -> type.getTypeCode(), type -> type.getDescription(),
                        (left, right) -> left));
        Map<String, String> categoryDescriptions = categories.findAllCategories().stream()
                .collect(Collectors.toMap(
                        category -> TransactionApplicationService.categoryKey(
                                category.getTypeCode(), category.getCategoryCode()),
                        category -> category.getDescription(), (left, right) -> left));
        for (TransactionRecord row : rows) {
            boolean typeMissing = !typeDescriptions.containsKey(row.getTypeCode());
            boolean categoryMissing = !categoryDescriptions.containsKey(
                    TransactionApplicationService.categoryKey(row.getTypeCode(), row.getCategoryCode()));
            if (typeMissing || categoryMissing) {
                throw new BusinessRuleException("REPORT_REFERENCE_ERROR",
                        "Transaction " + row.getTransactionId()
                                + " references an unknown transaction type or category.");
            }
        }
    }

    private List<TransactionView> toViews(List<TransactionRecord> rows) {
        Map<String, String> typeDescriptions = types.findAllTypes().stream()
                .collect(Collectors.toMap(type -> type.getTypeCode(), type -> type.getDescription(),
                        (left, right) -> left));
        Map<String, String> categoryDescriptions = categories.findAllCategories().stream()
                .collect(Collectors.toMap(
                        category -> TransactionApplicationService.categoryKey(
                                category.getTypeCode(), category.getCategoryCode()),
                        category -> category.getDescription(), (left, right) -> left));
        List<TransactionView> views = new ArrayList<>(rows.size());
        for (TransactionRecord row : rows) {
            views.add(new TransactionView(row, typeDescriptions.get(row.getTypeCode()),
                    categoryDescriptions.get(TransactionApplicationService.categoryKey(
                            row.getTypeCode(), row.getCategoryCode()))));
        }
        return views;
    }

    private static List<TransactionRecord> slice(List<TransactionRecord> rows, int page, int size) {
        if (size <= 0) {
            return List.of();
        }
        int from = Math.min(page * size, rows.size());
        int to = Math.min(from + size, rows.size());
        return rows.subList(from, to);
    }

    private static BigDecimal sum(List<TransactionRecord> rows) {
        return rows.stream().map(TransactionRecord::getAmount).reduce(ZERO, BigDecimal::add);
    }
}
