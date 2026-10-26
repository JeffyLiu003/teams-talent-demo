package com.carddemo.iam.infrastructure.persistence;

import com.carddemo.iam.domain.model.User;
import com.carddemo.iam.domain.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserJpaRepository extends JpaRepository<User, String>, UserRepository {

    long countByUserType(String userType);

    boolean existsByUserId(String userId);

    @Override
    default Optional<User> findByUserId(String userId) {
        return findById(userId);
    }

    @Override
    default User saveUser(User user) {
        return save(user);
    }

    @Override
    default List<User> findAllUsers(int page, int size) {
        return findAll(PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "userId"))).getContent();
    }

    @Override
    default long countUsers() {
        return count();
    }

    @Override
    default void deleteUser(String userId) {
        deleteById(userId);
    }
}
