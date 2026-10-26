package com.carddemo.authorization.interfaces.rest.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * 过期授权清理请求（POST /api/v1/authorization-purges）。expiryDays 缺省 5，取值 1..365。
 */
public record PurgeRequest(
        @Min(value = 1, message = "Expiry Days must be between 1 and 365.")
        @Max(value = 365, message = "Expiry Days must be between 1 and 365.")
        Integer expiryDays) {
}
