package com.carddemo.transaction.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * 交易类别（TRANCATG / CVTRA04Y）。
 */
@Entity
@Table(name = "tran_category")
public class TranCategory {

    @EmbeddedId
    private TranCategoryId id;

    @Column(name = "description", length = 50, nullable = false)
    private String description;

    protected TranCategory() {
        // for JPA
    }

    public TranCategory(String typeCode, String categoryCode, String description) {
        this.id = new TranCategoryId(typeCode, categoryCode);
        this.description = description;
    }

    public TranCategoryId getId() {
        return id;
    }

    public String getTypeCode() {
        return id.getTypeCode();
    }

    public String getCategoryCode() {
        return id.getCategoryCode();
    }

    public String getDescription() {
        return description;
    }
}
