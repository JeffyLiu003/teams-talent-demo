package com.carddemo.marketing.domain.model;

import java.math.BigDecimal;

/**
 * 账户快照（来自 account-service），营销只读，不保存。
 */
public record AccountSnapshot(String accountId, String activeStatus, BigDecimal currentBalance, String groupId) {
}
