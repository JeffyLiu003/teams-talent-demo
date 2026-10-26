package com.carddemo.authorization.domain.model;

/**
 * 客户存在性快照（customer-service 只读投影）。授权上下文不使用客户资料字段。
 */
public record CustomerSnapshot(String customerId) {
}
