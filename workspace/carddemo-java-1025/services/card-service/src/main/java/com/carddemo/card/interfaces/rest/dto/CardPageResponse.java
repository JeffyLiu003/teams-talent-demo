package com.carddemo.card.interfaces.rest.dto;

import com.carddemo.card.domain.repository.CardPage;

import java.util.List;

/**
 * 分页卡片列表：{"items": [...], "page": 0, "size": 7, "total": 2}。
 */
public record CardPageResponse(
        List<CardResponse> items,
        int page,
        int size,
        long total) {

    public static CardPageResponse from(CardPage cardPage) {
        return new CardPageResponse(
                cardPage.items().stream().map(CardResponse::from).toList(),
                cardPage.page(),
                cardPage.size(),
                cardPage.total());
    }
}
