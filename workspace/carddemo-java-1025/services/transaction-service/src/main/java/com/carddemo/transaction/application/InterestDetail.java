package com.carddemo.transaction.application;

import java.math.BigDecimal;

public record InterestDetail(String accountId, BigDecimal interestAmount) {
}
