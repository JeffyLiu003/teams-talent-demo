package com.carddemo.authorization.infrastructure.client;

import com.carddemo.authorization.domain.model.CustomerSnapshot;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * customer-service 的 CustomerResponse 投影（授权只判断客户是否存在，SSN 等字段丢弃）。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
record CustomerBody(String customerId) {

    CustomerSnapshot toSnapshot() {
        return new CustomerSnapshot(customerId);
    }
}
