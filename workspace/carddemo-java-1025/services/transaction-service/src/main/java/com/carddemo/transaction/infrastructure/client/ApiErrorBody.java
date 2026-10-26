package com.carddemo.transaction.infrastructure.client;

/**
 * 下游错误响应体：{"code": "...", "message": "...", "details": [...]}。
 */
record ApiErrorBody(String code, String message) {
}
