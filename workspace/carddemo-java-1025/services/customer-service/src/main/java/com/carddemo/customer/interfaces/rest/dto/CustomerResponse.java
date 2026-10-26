package com.carddemo.customer.interfaces.rest.dto;

import com.carddemo.customer.domain.model.Customer;

import java.time.LocalDate;

/**
 * BR-CUST-07：SSN 只以 {@code ***-**-1234} 形式返回，永不返回原文。
 */
public record CustomerResponse(
        String customerId,
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
        String ssnMasked,
        LocalDate dateOfBirth,
        String eftAccountId,
        String primaryCardHolder,
        Integer ficoScore,
        long version) {

    public static CustomerResponse from(Customer customer) {
        return new CustomerResponse(
                customer.getCustomerId(),
                customer.getFirstName(),
                customer.getMiddleName(),
                customer.getLastName(),
                customer.getAddressLine1(),
                customer.getAddressLine2(),
                customer.getAddressLine3(),
                customer.getStateCode(),
                customer.getCountryCode(),
                customer.getZipCode(),
                customer.getPhoneNumber1(),
                customer.getPhoneNumber2(),
                customer.maskedSsn(),
                customer.getDateOfBirth(),
                customer.getEftAccountId(),
                customer.getPrimaryCardHolder(),
                customer.getFicoScore(),
                customer.getVersion());
    }
}
