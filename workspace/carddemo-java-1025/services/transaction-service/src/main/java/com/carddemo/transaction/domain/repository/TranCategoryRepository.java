package com.carddemo.transaction.domain.repository;

import com.carddemo.transaction.domain.model.TranCategory;

import java.util.List;
import java.util.Optional;

/**
 * 交易类别仓储端口。
 */
public interface TranCategoryRepository {

    List<TranCategory> findAllCategories();

    List<TranCategory> findByTypeCode(String typeCode);

    Optional<TranCategory> findCategory(String typeCode, String categoryCode);
}
