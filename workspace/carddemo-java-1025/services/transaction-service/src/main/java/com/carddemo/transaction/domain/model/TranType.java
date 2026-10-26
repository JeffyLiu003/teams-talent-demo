package com.carddemo.transaction.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 交易类型（TRANTYPE / CVTRA03Y）。BR-TT-01：本期只支持查询与描述维护。
 */
@Entity
@Table(name = "tran_type")
public class TranType {

    @Id
    @Column(name = "type_code", length = 2, nullable = false, updatable = false)
    private String typeCode;

    @Column(name = "description", length = 50, nullable = false)
    private String description;

    protected TranType() {
        // for JPA
    }

    public TranType(String typeCode, String description) {
        this.typeCode = typeCode;
        this.description = description;
    }

    public void updateDescription(String description) {
        this.description = description;
    }

    public String getTypeCode() {
        return typeCode;
    }

    public String getDescription() {
        return description;
    }
}
