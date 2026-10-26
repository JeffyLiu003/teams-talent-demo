package com.carddemo.authorization.domain.repository;

import java.util.List;

/**
 * 分页结果（避免领域层依赖 Spring Data 的 Page）。
 */
public record PageResult<T>(List<T> items, long total) {
}
