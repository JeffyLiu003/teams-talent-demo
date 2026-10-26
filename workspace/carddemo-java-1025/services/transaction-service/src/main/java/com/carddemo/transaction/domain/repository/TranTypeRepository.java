package com.carddemo.transaction.domain.repository;

import com.carddemo.transaction.domain.model.TranType;

import java.util.List;
import java.util.Optional;

/**
 * 交易类型仓储端口。
 */
public interface TranTypeRepository {

    List<TranType> findAllTypes();

    Optional<TranType> findType(String typeCode);

    TranType saveType(TranType type);
}
