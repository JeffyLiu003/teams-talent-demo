package com.carddemo.transaction.interfaces.rest.dto;

import com.carddemo.transaction.application.InterestDetail;

import java.math.BigDecimal;

public record InterestDetailResponse(String accountId, BigDecimal interestAmount) {

    public static InterestDetailResponse from(InterestDetail detail) {
        return new InterestDetailResponse(detail.accountId(), detail.interestAmount());
    }
}
