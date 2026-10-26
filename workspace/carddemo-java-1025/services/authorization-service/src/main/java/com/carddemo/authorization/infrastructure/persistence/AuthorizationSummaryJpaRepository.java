package com.carddemo.authorization.infrastructure.persistence;

import com.carddemo.authorization.domain.model.AuthorizationSummary;
import com.carddemo.authorization.domain.repository.AuthorizationSummaryRepository;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AuthorizationSummaryJpaRepository
        extends JpaRepository<AuthorizationSummary, String>, AuthorizationSummaryRepository {

    @Override
    default Optional<AuthorizationSummary> findSummary(String accountId) {
        return findById(accountId);
    }

    @Override
    default AuthorizationSummary saveSummary(AuthorizationSummary summary) {
        return save(summary);
    }

    @Override
    default void deleteSummary(AuthorizationSummary summary) {
        delete(summary);
    }

    @Override
    default long countSummaries() {
        return count();
    }
}
