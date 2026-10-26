package com.carddemo.transaction.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.util.Objects;

/**
 * 披露组组合键：披露组 + 类型码 + 类别码（DISCGRP KEYS(16 0)）。
 */
@Embeddable
public class DisclosureGroupId {

    @Column(name = "group_id", length = 10, nullable = false, updatable = false)
    private String groupId;

    @Column(name = "type_code", length = 2, nullable = false, updatable = false)
    private String typeCode;

    @Column(name = "category_code", length = 4, nullable = false, updatable = false)
    private String categoryCode;

    protected DisclosureGroupId() {
        // for JPA
    }

    public DisclosureGroupId(String groupId, String typeCode, String categoryCode) {
        this.groupId = groupId;
        this.typeCode = typeCode;
        this.categoryCode = categoryCode;
    }

    public String getGroupId() {
        return groupId;
    }

    public String getTypeCode() {
        return typeCode;
    }

    public String getCategoryCode() {
        return categoryCode;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof DisclosureGroupId that)) {
            return false;
        }
        return Objects.equals(groupId, that.groupId)
                && Objects.equals(typeCode, that.typeCode)
                && Objects.equals(categoryCode, that.categoryCode);
    }

    @Override
    public int hashCode() {
        return Objects.hash(groupId, typeCode, categoryCode);
    }
}
