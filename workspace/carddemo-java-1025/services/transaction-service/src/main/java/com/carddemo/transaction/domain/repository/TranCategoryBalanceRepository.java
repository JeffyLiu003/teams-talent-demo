package com.carddemo.transaction.domain.repository;

import com.carddemo.transaction.domain.model.TranCategoryBalance;

import java.util.List;
import java.util.Optional;

/**
 * 交易类别累计仓储端口。
 */
public interface TranCategoryBalanceRepository {

    Optional<TranCategoryBalance> find(String accountId, String typeCode, String categoryCode);

    TranCategoryBalance saveBalance(TranCategoryBalance balance);

    List<TranCategoryBalance> findByAccountId(String accountId);

    List<String> findDistinctAccountIds();
}
