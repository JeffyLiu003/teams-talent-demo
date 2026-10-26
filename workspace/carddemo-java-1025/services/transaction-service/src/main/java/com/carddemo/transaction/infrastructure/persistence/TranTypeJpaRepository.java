package com.carddemo.transaction.infrastructure.persistence;

import com.carddemo.transaction.domain.model.TranType;
import com.carddemo.transaction.domain.repository.TranTypeRepository;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TranTypeJpaRepository extends JpaRepository<TranType, String>, TranTypeRepository {

    @Override
    default List<TranType> findAllTypes() {
        return findAll(Sort.by(Sort.Direction.ASC, "typeCode"));
    }

    @Override
    default Optional<TranType> findType(String typeCode) {
        return findById(typeCode);
    }

    @Override
    default TranType saveType(TranType type) {
        return saveAndFlush(type);
    }
}
