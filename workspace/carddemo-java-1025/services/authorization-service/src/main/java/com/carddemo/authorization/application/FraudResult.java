package com.carddemo.authorization.application;

/**
 * 欺诈标记结果（POST /api/v1/authorizations/{authorizationId}/fraud 响应）。
 */
public record FraudResult(String authorizationId, String fraudFlag, String cardNumber, boolean cardBlocked) {
}
