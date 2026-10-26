package com.carddemo.authorization.domain.repository;

import com.carddemo.authorization.domain.model.CardFraudFlag;

import java.util.Optional;

/**
 * 卡级欺诈标记仓储端口（card_fraud_flag）。实现见 infrastructure.persistence.CardFraudFlagJpaRepository。
 */
public interface CardFraudFlagRepository {

    Optional<CardFraudFlag> findFlag(String cardNumber);

    CardFraudFlag saveFlag(CardFraudFlag flag);
}
