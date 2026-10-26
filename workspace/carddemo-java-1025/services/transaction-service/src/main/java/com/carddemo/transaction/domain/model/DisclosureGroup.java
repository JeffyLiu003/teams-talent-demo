package com.carddemo.transaction.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.math.BigDecimal;

/**
 * 披露组利率（DISCGRP / CVTRA02Y）。年利率百分数，缺失时回退 DEFAULT 组（BR-INT-02）。
 */
@Entity
@Table(name = "disclosure_group")
public class DisclosureGroup {

    @EmbeddedId
    private DisclosureGroupId id;

    @Column(name = "interest_rate", nullable = false, precision = 6, scale = 2)
    private BigDecimal interestRate;

    protected DisclosureGroup() {
        // for JPA
    }

    public DisclosureGroup(String groupId, String typeCode, String categoryCode, BigDecimal interestRate) {
        this.id = new DisclosureGroupId(groupId, typeCode, categoryCode);
        this.interestRate = interestRate;
    }

    public DisclosureGroupId getId() {
        return id;
    }

    public String getGroupId() {
        return id.getGroupId();
    }

    public String getTypeCode() {
        return id.getTypeCode();
    }

    public String getCategoryCode() {
        return id.getCategoryCode();
    }

    public BigDecimal getInterestRate() {
        return interestRate;
    }
}
