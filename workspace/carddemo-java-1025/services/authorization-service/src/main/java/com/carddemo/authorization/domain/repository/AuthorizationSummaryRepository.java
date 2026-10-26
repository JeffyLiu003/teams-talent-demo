package com.carddemo.authorization.domain.repository;

import com.carddemo.authorization.domain.model.AuthorizationSummary;

import java.util.Optional;

/**
 * 待授权汇总仓储端口（auth_summary）。实现见 infrastructure.persistence.AuthorizationSummaryJpaRepository。
 */
public interface AuthorizationSummaryRepository {

    Optional<AuthorizationSummary> findSummary(String accountId);

    AuthorizationSummary saveSummary(AuthorizationSummary summary);

    void deleteSummary(AuthorizationSummary summary);

    long countSummaries();
}
