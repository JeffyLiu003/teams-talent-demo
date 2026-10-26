package com.carddemo.authorization.infrastructure.persistence;

import com.carddemo.authorization.domain.model.CardFraudFlag;
import com.carddemo.authorization.domain.repository.CardFraudFlagRepository;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CardFraudFlagJpaRepository
        extends JpaRepository<CardFraudFlag, String>, CardFraudFlagRepository {

    @Override
    default Optional<CardFraudFlag> findFlag(String cardNumber) {
        return findById(cardNumber);
    }

    @Override
    default CardFraudFlag saveFlag(CardFraudFlag flag) {
        return save(flag);
    }
}
