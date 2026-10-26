package com.carddemo.iam.domain.repository;

import com.carddemo.iam.domain.model.User;

import java.util.List;
import java.util.Optional;

/**
 * 用户仓储端口。实现见 infrastructure.persistence.UserJpaRepository。
 */
public interface UserRepository {

    Optional<User> findByUserId(String userId);

    boolean existsByUserId(String userId);

    User saveUser(User user);

    /**
     * BR-USER-05：按用户号升序分页。
     */
    List<User> findAllUsers(int page, int size);

    long countUsers();

    long countByUserType(String userType);

    void deleteUser(String userId);
}
