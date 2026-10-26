package com.carddemo.transaction.interfaces.rest.dto;

import com.carddemo.transaction.domain.model.TranCategory;

public record TransactionCategoryResponse(String typeCode, String categoryCode, String description) {

    public static TransactionCategoryResponse from(TranCategory category) {
        return new TransactionCategoryResponse(category.getTypeCode(), category.getCategoryCode(),
                category.getDescription());
    }
}
