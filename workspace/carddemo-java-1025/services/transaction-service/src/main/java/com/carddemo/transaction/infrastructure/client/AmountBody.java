package com.carddemo.transaction.infrastructure.client;

import java.math.BigDecimal;

/**
 * account-service 金额请求体：{"amount": 125.40}。
 */
record AmountBody(BigDecimal amount) {
}
