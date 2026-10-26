package com.carddemo.card.infrastructure.persistence;

import com.carddemo.card.domain.model.CardXref;
import com.carddemo.card.domain.repository.CardXrefRepository;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CardXrefJpaRepository extends JpaRepository<CardXref, String>, CardXrefRepository {

    @Override
    default CardXref saveXref(CardXref xref) {
        return save(xref);
    }
}
