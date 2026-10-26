package com.carddemo.transaction.interfaces.rest.dto;

import com.carddemo.transaction.application.InterestRunResult;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record InterestRunResponse(
        LocalDate statementDate,
        int accountsProcessed,
        int interestPosted,
        BigDecimal totalInterest,
        List<InterestDetailResponse> details) {

    public static InterestRunResponse from(InterestRunResult result) {
        return new InterestRunResponse(result.statementDate(), result.accountsProcessed(),
                result.interestPosted(), result.totalInterest(),
                result.details().stream().map(InterestDetailResponse::from).toList());
    }
}
