package com.carddemo.account.infrastructure.persistence;

import com.carddemo.account.domain.model.Account;
import com.carddemo.account.domain.repository.AccountRepository;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AccountJpaRepository extends JpaRepository<Account, String>, AccountRepository {

    @Override
    default Optional<Account> findByAccountId(String accountId) {
        return findById(accountId);
    }

    @Override
    default Account saveAccount(Account account) {
        return save(account);
    }

    @Override
    default List<Account> findAllAccounts() {
        return findAll();
    }
}
