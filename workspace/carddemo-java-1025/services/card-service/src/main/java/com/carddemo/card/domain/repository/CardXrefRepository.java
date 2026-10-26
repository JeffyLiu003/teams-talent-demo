package com.carddemo.card.domain.repository;

import com.carddemo.card.domain.model.CardXref;

/**
 * 交叉引用仓储端口。实现见 infrastructure.persistence.CardXrefJpaRepository。
 */
public interface CardXrefRepository {

    CardXref saveXref(CardXref xref);
}
