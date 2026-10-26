package com.carddemo.card.domain.model;

/**
 * 卡片维护可编辑字段集合，对应 COCRDUPC 屏幕：卡面名、状态、到期月/年（日不可编辑、CVV 不可编辑）。
 */
public record CardMaintenance(
        String embossedName,
        String activeStatus,
        int expiryMonth,
        int expiryYear) {
}
