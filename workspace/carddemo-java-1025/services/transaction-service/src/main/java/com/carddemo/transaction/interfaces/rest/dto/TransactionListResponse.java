package com.carddemo.transaction.interfaces.rest.dto;

import com.carddemo.transaction.application.TransactionView;
import com.carddemo.transaction.domain.repository.PageResult;

import java.util.List;

public record TransactionListResponse(List<TransactionResponse> items, int page, int size, long total) {

    public static TransactionListResponse from(PageResult<TransactionView> result, int page, int size) {
        return new TransactionListResponse(
                result.items().stream().map(TransactionResponse::from).toList(),
                page,
                size,
                result.total());
    }
}
