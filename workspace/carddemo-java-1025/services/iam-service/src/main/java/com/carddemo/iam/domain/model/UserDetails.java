package com.carddemo.iam.domain.model;

/**
 * 用户可维护字段集合。对应遗留安全文件 USRSEC（copybook CSUSR01Y）中的姓名与类型部分。
 */
public record UserDetails(String firstName, String lastName, String userType) {
}
