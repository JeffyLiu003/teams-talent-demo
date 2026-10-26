package com.carddemo.customer.application;

import java.util.List;

/**
 * 分页结果。REST 适配器映射为 {@code {"items": [...], "page": 0, "size": 10, "total": 8}}。
 */
public record PageResult<T>(List<T> items, int page, int size, long total) {
}
