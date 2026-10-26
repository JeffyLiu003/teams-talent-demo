package com.carddemo.transaction.infrastructure.persistence;

import com.carddemo.transaction.domain.model.TranCategoryBalance;
import com.carddemo.transaction.domain.model.TranCategoryBalanceId;
import com.carddemo.transaction.domain.repository.TranCategoryBalanceRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TranCategoryBalanceJpaRepository
        extends JpaRepository<TranCategoryBalance, TranCategoryBalanceId>, TranCategoryBalanceRepository {

    @Override
    default Optional<TranCategoryBalance> find(String accountId, String typeCode, String categoryCode) {
        return findById(new TranCategoryBalanceId(accountId, typeCode, categoryCode));
    }

    @Override
    default TranCategoryBalance saveBalance(TranCategoryBalance balance) {
        return saveAndFlush(balance);
    }

    @Override
    @Query("select b from TranCategoryBalance b where b.id.accountId = :accountId"
            + " order by b.id.typeCode asc, b.id.categoryCode asc")
    List<TranCategoryBalance> findByAccountId(@Param("accountId") String accountId);

    @Override
    @Query("select distinct b.id.accountId from TranCategoryBalance b order by b.id.accountId asc")
    List<String> findDistinctAccountIds();
}
