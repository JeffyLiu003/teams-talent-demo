package com.carddemo.account.domain.repository;

import com.carddemo.account.domain.model.Account;

import java.util.List;
import java.util.Optional;

/**
 * 账户仓储端口。实现见 infrastructure.persistence.AccountJpaRepository。
 */
public interface AccountRepository {

    Optional<Account> findByAccountId(String accountId);

    Account saveAccount(Account account);

    List<Account> findAllAccounts();
}
