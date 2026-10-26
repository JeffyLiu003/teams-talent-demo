package com.carddemo.authorization.application;

import java.math.BigDecimal;

/**
 * 过期授权清理结果（POST /api/v1/authorization-purges 响应）。
 * creditBalanceReleased = 被删除的批准明细金额之和（NR-AUTH-01）。
 */
public record PurgeResult(
        int summariesRead,
        int summariesDeleted,
        int detailsRead,
        int detailsDeleted,
        BigDecimal creditBalanceReleased) {
}
