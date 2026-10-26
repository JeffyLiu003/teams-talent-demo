package com.carddemo.authorization.interfaces.rest.dto;

import com.carddemo.authorization.domain.model.AuthorizationCase;
import com.carddemo.authorization.domain.repository.PageResult;

import java.util.List;

/**
 * 授权明细分页响应（GET /api/v1/authorizations），按 authTimestamp 倒序。
 */
public record AuthorizationListResponse(List<AuthorizationListItem> items, int page, int size, long total) {

    public static AuthorizationListResponse from(PageResult<AuthorizationCase> result, int page, int size) {
        return new AuthorizationListResponse(
                result.items().stream().map(AuthorizationListItem::from).toList(),
                page,
                size,
                result.total());
    }
}
