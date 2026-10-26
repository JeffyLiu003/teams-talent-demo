package com.carddemo.transaction.application;

import com.carddemo.transaction.domain.repository.TransactionRepository;
import org.springframework.stereotype.Component;

import java.math.BigInteger;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * 交易号生成：BR-TRN-07 = 当前最大交易号 + 1（16 位，零填充）；
 * 利息交易 = yyyyMMdd + 8 位序号（CBACT04C 474-480）。
 */
@Component
public class TransactionIdGenerator {

    private static final DateTimeFormatter DATE_PREFIX = DateTimeFormatter.BASIC_ISO_DATE;
    private static final String FORMAT = "%016d";

    private final TransactionRepository transactions;

    public TransactionIdGenerator(TransactionRepository transactions) {
        this.transactions = transactions;
    }

    public String next() {
        return increment(transactions.findMaxTransactionId().orElse(null));
    }

    /**
     * 在给定交易号基础上 +1；给定为空时从 1 开始。
     */
    public String increment(String transactionId) {
        BigInteger next = transactionId == null || transactionId.isBlank()
                ? BigInteger.ONE
                : new BigInteger(transactionId).add(BigInteger.ONE);
        return String.format(FORMAT, next);
    }

    /**
     * 利息交易号：yyyyMMdd + 8 位序号，序号按当日已有交易号递增。
     */
    public String nextForDate(LocalDate date) {
        String prefix = date.format(DATE_PREFIX);
        String max = transactions.findMaxTransactionIdByPrefix(prefix).orElse(null);
        long sequence = max == null ? 1L : Long.parseLong(max.substring(prefix.length())) + 1L;
        return prefix + String.format("%08d", sequence);
    }
}
