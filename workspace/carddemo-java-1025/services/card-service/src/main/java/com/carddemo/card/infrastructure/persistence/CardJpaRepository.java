package com.carddemo.card.infrastructure.persistence;

import com.carddemo.card.domain.model.Card;
import com.carddemo.card.domain.repository.CardPage;
import com.carddemo.card.domain.repository.CardRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CardJpaRepository extends JpaRepository<Card, String>, CardRepository {

    List<Card> findByAccountIdOrderByCardNumberAsc(String accountId);

    Page<Card> findByAccountId(String accountId, Pageable pageable);

    Page<Card> findByCustomerId(String customerId, Pageable pageable);

    Page<Card> findByAccountIdAndCustomerId(String accountId, String customerId, Pageable pageable);

    @Override
    default Optional<Card> findByCardNumber(String cardNumber) {
        return findById(cardNumber);
    }

    @Override
    default boolean existsByCardNumber(String cardNumber) {
        return existsById(cardNumber);
    }

    @Override
    default List<Card> findByAccountId(String accountId) {
        return findByAccountIdOrderByCardNumberAsc(accountId);
    }

    @Override
    default CardPage findPage(String accountId, String customerId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Order.asc("cardNumber")));
        Page<Card> result;
        if (accountId != null && customerId != null) {
            result = findByAccountIdAndCustomerId(accountId, customerId, pageable);
        } else if (accountId != null) {
            result = findByAccountId(accountId, pageable);
        } else if (customerId != null) {
            result = findByCustomerId(customerId, pageable);
        } else {
            result = findAll(pageable);
        }
        return new CardPage(result.getContent(), page, size, result.getTotalElements());
    }

    @Override
    default Card saveCard(Card card) {
        return save(card);
    }
}
