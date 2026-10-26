package com.carddemo.transaction.application;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record InterestRunResult(
        LocalDate statementDate,
        int accountsProcessed,
        int interestPosted,
        BigDecimal totalInterest,
        List<InterestDetail> details) {
}
