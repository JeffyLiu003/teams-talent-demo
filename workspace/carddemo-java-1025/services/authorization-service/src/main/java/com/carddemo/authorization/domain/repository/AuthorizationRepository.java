package com.carddemo.authorization.domain.repository;

import com.carddemo.authorization.domain.model.AuthorizationCase;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 授权明细仓储端口（auth_detail）。实现见 infrastructure.persistence.AuthorizationJpaRepository。
 */
public interface AuthorizationRepository {

    Optional<AuthorizationCase> findAuthorization(String authorizationId);

    AuthorizationCase saveAuthorization(AuthorizationCase authorization);

    /**
     * BR-AUTH-12：按账户分页查询明细，authTimestamp 倒序。
     */
    PageResult<AuthorizationCase> findByAccountId(String accountId, int page, int size);

    /**
     * 该账户全部剩余明细（过期清理后重算汇总用）。
     */
    List<AuthorizationCase> findAllByAccountId(String accountId);

    /**
     * BR-AUTH-13：authTimestamp 早于 cutoff 的明细。
     */
    List<AuthorizationCase> findExpired(LocalDateTime cutoff);

    int deleteExpired(LocalDateTime cutoff);

    long countAuthorizations();
}
