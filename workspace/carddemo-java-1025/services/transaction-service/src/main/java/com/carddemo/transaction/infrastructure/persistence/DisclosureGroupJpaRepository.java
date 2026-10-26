package com.carddemo.transaction.infrastructure.persistence;

import com.carddemo.transaction.domain.model.DisclosureGroup;
import com.carddemo.transaction.domain.model.DisclosureGroupId;
import com.carddemo.transaction.domain.repository.DisclosureGroupRepository;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DisclosureGroupJpaRepository
        extends JpaRepository<DisclosureGroup, DisclosureGroupId>, DisclosureGroupRepository {

    @Override
    default Optional<DisclosureGroup> find(String groupId, String typeCode, String categoryCode) {
        return findById(new DisclosureGroupId(groupId, typeCode, categoryCode));
    }
}
