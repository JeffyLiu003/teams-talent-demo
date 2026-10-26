package com.carddemo.transaction.domain.model;

/**
 * 交易状态。入账与录入落库为 POSTED；账单支付按 ADR-005 先落 PENDING，下游成功后再置 POSTED。
 */
public enum TransactionStatus {
    PENDING,
    POSTED
}
