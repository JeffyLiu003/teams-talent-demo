package com.carddemo.customer.domain.model;

import java.time.LocalDate;

/**
 * 客户可维护字段集合，对应遗留 CUSTDAT 记录（copybook CVCUS01Y）的可编辑部分。
 * {@code ssn} 为 null 表示保持不变（PUT 时省略）。
 */
public record CustomerDetails(
        String firstName,
        String middleName,
        String lastName,
        String addressLine1,
        String addressLine2,
        String addressLine3,
        String stateCode,
        String countryCode,
        String zipCode,
        String phoneNumber1,
        String phoneNumber2,
        String ssn,
        LocalDate dateOfBirth,
        String eftAccountId,
        String primaryCardHolder,
        Integer ficoScore) {
}
