package com.carddemo.transaction.domain.repository;

import com.carddemo.transaction.domain.model.DailyTransaction;

/**
 * 日交易仓储端口。
 */
public interface DailyTransactionRepository {

    DailyTransaction saveDailyTransaction(DailyTransaction dailyTransaction);
}
