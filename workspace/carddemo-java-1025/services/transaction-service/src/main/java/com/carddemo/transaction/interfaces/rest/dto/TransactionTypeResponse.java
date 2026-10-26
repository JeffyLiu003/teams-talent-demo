package com.carddemo.transaction.interfaces.rest.dto;

import com.carddemo.transaction.domain.model.TranType;

public record TransactionTypeResponse(String typeCode, String description) {

    public static TransactionTypeResponse from(TranType type) {
        return new TransactionTypeResponse(type.getTypeCode(), type.getDescription());
    }
}
