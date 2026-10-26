package com.carddemo.customer.interfaces.rest.dto;

import com.carddemo.customer.domain.model.CustomerDetails;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * 新增客户请求（NR-CUST-01）。复杂规则（州代码、邮编非零、FICO 区间、电话分段）由领域实体校验。
 */
public record CreateCustomerRequest(
        @NotBlank(message = "Customer ID must be supplied.")
        @Pattern(regexp = "\\d{9}", message = "Customer ID must be 9 digits.")
        String customerId,

        @NotBlank(message = "First Name must be supplied.")
        @Size(max = 25, message = "First Name must be 25 characters or fewer.")
        String firstName,

        @Size(max = 25, message = "Middle Name must be 25 characters or fewer.")
        String middleName,

        @NotBlank(message = "Last Name must be supplied.")
        @Size(max = 25, message = "Last Name must be 25 characters or fewer.")
        String lastName,

        @NotBlank(message = "Address Line 1 must be supplied.")
        @Size(max = 50, message = "Address Line 1 must be 50 characters or fewer.")
        String addressLine1,

        @Size(max = 50, message = "Address Line 2 must be 50 characters or fewer.")
        String addressLine2,

        @NotBlank(message = "City must be supplied.")
        @Size(max = 50, message = "City must be 50 characters or fewer.")
        String addressLine3,

        @NotBlank(message = "State must be supplied.")
        String stateCode,

        @NotBlank(message = "Country must be supplied.")
        String countryCode,

        @NotBlank(message = "Zip code must be supplied.")
        String zipCode,

        String phoneNumber1,

        String phoneNumber2,

        @NotBlank(message = "SSN must be supplied.")
        @Pattern(regexp = "\\d{9}", message = "SSN must be 9 digits.")
        String ssn,

        LocalDate dateOfBirth,

        @NotBlank(message = "EFT Account ID must be supplied.")
        String eftAccountId,

        @NotBlank(message = "Primary Card Holder must be supplied.")
        String primaryCardHolder,

        Integer ficoScore) {

    public CustomerDetails toDetails() {
        return new CustomerDetails(firstName, middleName, lastName, addressLine1, addressLine2,
                addressLine3, stateCode, countryCode, zipCode, phoneNumber1, phoneNumber2, ssn,
                dateOfBirth, eftAccountId, primaryCardHolder, ficoScore);
    }
}
