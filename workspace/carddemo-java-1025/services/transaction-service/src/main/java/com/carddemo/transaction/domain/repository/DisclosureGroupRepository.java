package com.carddemo.transaction.domain.repository;

import com.carddemo.transaction.domain.model.DisclosureGroup;

import java.util.Optional;

/**
 * 披露组仓储端口。缺失时由调用方回退 {@code DEFAULT} 组（BR-INT-02）。
 */
public interface DisclosureGroupRepository {

    Optional<DisclosureGroup> find(String groupId, String typeCode, String categoryCode);
}
