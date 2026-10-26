package com.carddemo.transaction.application;

/**
 * 单笔拒付明细（BR-POST-05）。
 */
public record PostingRejection(String transactionId, int reasonCode, String reason) {
}
