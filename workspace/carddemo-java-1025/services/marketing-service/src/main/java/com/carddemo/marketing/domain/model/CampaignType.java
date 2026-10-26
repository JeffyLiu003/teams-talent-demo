package com.carddemo.marketing.domain.model;

public enum CampaignType {
    /** 活动期内首笔消费固定返现（开卡首刷礼）。 */
    FIRST_PURCHASE_CASHBACK,
    /** 指定交易类别的比例/固定返现（餐饮返现）。 */
    CATEGORY_CASHBACK,
    /** 指定交易类别的积分倍数（双倍积分）。 */
    POINTS_MULTIPLIER
}
