package com.carddemo.card.domain.repository;

import com.carddemo.card.domain.model.Card;

import java.util.List;

/**
 * 卡片列表分页结果（BR-CARD-02：按卡号升序、遗留每页 7 行）。
 */
public record CardPage(List<Card> items, int page, int size, long total) {
}
