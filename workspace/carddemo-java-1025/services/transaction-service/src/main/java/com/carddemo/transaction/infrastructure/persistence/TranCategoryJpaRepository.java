package com.carddemo.transaction.infrastructure.persistence;

import com.carddemo.transaction.domain.model.TranCategory;
import com.carddemo.transaction.domain.model.TranCategoryId;
import com.carddemo.transaction.domain.repository.TranCategoryRepository;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TranCategoryJpaRepository
        extends JpaRepository<TranCategory, TranCategoryId>, TranCategoryRepository {

    @Override
    default List<TranCategory> findAllCategories() {
        return findAll(Sort.by(Sort.Direction.ASC, "id.typeCode", "id.categoryCode"));
    }

    @Override
    @Query("select c from TranCategory c where c.id.typeCode = :typeCode order by c.id.categoryCode asc")
    List<TranCategory> findByTypeCode(@Param("typeCode") String typeCode);

    @Override
    default Optional<TranCategory> findCategory(String typeCode, String categoryCode) {
        return findById(new TranCategoryId(typeCode, categoryCode));
    }
}
