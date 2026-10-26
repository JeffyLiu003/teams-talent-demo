package com.carddemo.transaction.infrastructure.persistence;

import com.carddemo.transaction.domain.model.DailyTransaction;
import com.carddemo.transaction.domain.repository.DailyTransactionRepository;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DailyTransactionJpaRepository
        extends JpaRepository<DailyTransaction, String>, DailyTransactionRepository {

    @Override
    default DailyTransaction saveDailyTransaction(DailyTransaction dailyTransaction) {
        return saveAndFlush(dailyTransaction);
    }
}
