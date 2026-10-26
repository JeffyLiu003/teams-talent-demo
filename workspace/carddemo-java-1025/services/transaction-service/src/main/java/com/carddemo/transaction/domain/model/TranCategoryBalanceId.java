package com.carddemo.transaction.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.util.Objects;

/**
 * 类别累计组合键：账户号 + 类型码 + 类别码（TCATBALF KEYS(17 0)）。
 */
@Embeddable
public class TranCategoryBalanceId {

    @Column(name = "account_id", length = 11, nullable = false, updatable = false)
    private String accountId;

    @Column(name = "type_code", length = 2, nullable = false, updatable = false)
    private String typeCode;

    @Column(name = "category_code", length = 4, nullable = false, updatable = false)
    private String categoryCode;

    protected TranCategoryBalanceId() {
        // for JPA
    }

    public TranCategoryBalanceId(String accountId, String typeCode, String categoryCode) {
        this.accountId = accountId;
        this.typeCode = typeCode;
        this.categoryCode = categoryCode;
    }

    public String getAccountId() {
        return accountId;
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
        if (!(other instanceof TranCategoryBalanceId that)) {
            return false;
        }
        return Objects.equals(accountId, that.accountId)
                && Objects.equals(typeCode, that.typeCode)
                && Objects.equals(categoryCode, that.categoryCode);
    }

    @Override
    public int hashCode() {
        return Objects.hash(accountId, typeCode, categoryCode);
    }
}
