package com.carddemo.authorization.infrastructure.persistence;

import com.carddemo.authorization.domain.model.AuthorizationCase;
import com.carddemo.authorization.domain.repository.AuthorizationRepository;
import com.carddemo.authorization.domain.repository.PageResult;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AuthorizationJpaRepository
        extends JpaRepository<AuthorizationCase, String>, AuthorizationRepository {

    @Override
    default Optional<AuthorizationCase> findAuthorization(String authorizationId) {
        return findById(authorizationId);
    }

    @Override
    default AuthorizationCase saveAuthorization(AuthorizationCase authorization) {
        return save(authorization);
    }

    @Override
    default PageResult<AuthorizationCase> findByAccountId(String accountId, int page, int size) {
        Sort sort = Sort.by(Sort.Order.desc("authTimestamp"), Sort.Order.desc("authorizationId"));
        Page<AuthorizationCase> result = selectPageByAccountId(accountId, PageRequest.of(page, size, sort));
        return new PageResult<>(result.getContent(), result.getTotalElements());
    }

    @Override
    default List<AuthorizationCase> findAllByAccountId(String accountId) {
        return selectAllByAccountId(accountId);
    }

    @Override
    default List<AuthorizationCase> findExpired(LocalDateTime cutoff) {
        return selectExpired(cutoff);
    }

    @Override
    default int deleteExpired(LocalDateTime cutoff) {
        return deleteByAuthTimestampBefore(cutoff);
    }

    @Override
    default long countAuthorizations() {
        return count();
    }

    @Query("select a from AuthorizationCase a where a.accountId = :accountId")
    Page<AuthorizationCase> selectPageByAccountId(@Param("accountId") String accountId, Pageable pageable);

    @Query("select a from AuthorizationCase a where a.accountId = :accountId "
            + "order by a.authTimestamp desc, a.authorizationId desc")
    List<AuthorizationCase> selectAllByAccountId(@Param("accountId") String accountId);

    @Query("select a from AuthorizationCase a where a.authTimestamp < :cutoff order by a.authTimestamp")
    List<AuthorizationCase> selectExpired(@Param("cutoff") LocalDateTime cutoff);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from AuthorizationCase a where a.authTimestamp < :cutoff")
    int deleteByAuthTimestampBefore(@Param("cutoff") LocalDateTime cutoff);
}
