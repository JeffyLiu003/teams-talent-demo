package com.carddemo.transaction.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.util.Objects;

/**
 * 交易类别组合键：类型码 + 类别码（TRANCATG KEYS(6 0)）。
 */
@Embeddable
public class TranCategoryId {

    @Column(name = "type_code", length = 2, nullable = false, updatable = false)
    private String typeCode;

    @Column(name = "category_code", length = 4, nullable = false, updatable = false)
    private String categoryCode;

    protected TranCategoryId() {
        // for JPA
    }

    public TranCategoryId(String typeCode, String categoryCode) {
        this.typeCode = typeCode;
        this.categoryCode = categoryCode;
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
        if (!(other instanceof TranCategoryId that)) {
            return false;
        }
        return Objects.equals(typeCode, that.typeCode) && Objects.equals(categoryCode, that.categoryCode);
    }

    @Override
    public int hashCode() {
        return Objects.hash(typeCode, categoryCode);
    }
}
