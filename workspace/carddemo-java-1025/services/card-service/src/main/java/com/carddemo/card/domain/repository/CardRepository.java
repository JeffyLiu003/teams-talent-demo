package com.carddemo.card.domain.repository;

import com.carddemo.card.domain.model.Card;

import java.util.List;
import java.util.Optional;

/**
 * 卡片仓储端口。实现见 infrastructure.persistence.CardJpaRepository。
 */
public interface CardRepository {

    Optional<Card> findByCardNumber(String cardNumber);

    boolean existsByCardNumber(String cardNumber);

    List<Card> findByAccountId(String accountId);

    CardPage findPage(String accountId, String customerId, int page, int size);

    Card saveCard(Card card);
}
