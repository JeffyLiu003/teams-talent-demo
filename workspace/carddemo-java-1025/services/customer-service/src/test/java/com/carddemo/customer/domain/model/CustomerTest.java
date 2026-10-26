package com.carddemo.customer.domain.model;

import com.carddemo.customer.domain.exception.ValidationException;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 客户聚合的字段规则（BR-CUST-01..11）。每条规则给出正例与反例。
 */
class CustomerTest {

    private static final String VALID_SSN = "123456789";

    @Test
    void createsCustomerWithNormalizedFields() {
        Customer customer = new Customer("000000001", details().build());

        assertThat(customer.getCustomerId()).isEqualTo("000000001");
        assertThat(customer.getStateCode()).isEqualTo("NY");
        assertThat(customer.getCountryCode()).isEqualTo("USA");
        assertThat(customer.getPhoneNumber1()).isEqualTo("(212)555-0101");
        assertThat(customer.getSsn()).isEqualTo(VALID_SSN);
        assertThat(customer.maskedSsn()).isEqualTo("***-**-6789");
        assertThat(customer.getVersion()).isZero();
    }

    @Test
    void normalizesUnformattedPhoneAndUppercasesState() {
        Customer customer = new Customer("000000001",
                details().phoneNumber1("2125550101").stateCode("ny").countryCode("usa").build());

        assertThat(customer.getPhoneNumber1()).isEqualTo("(212)555-0101");
        assertThat(customer.getStateCode()).isEqualTo("NY");
        assertThat(customer.getCountryCode()).isEqualTo("USA");
    }

    @Test
    void rejectsCustomerIdThatIsNotNineDigits() {
        assertThatThrownBy(() -> new Customer("00000001", details().build()))
                .isInstanceOf(ValidationException.class)
                .extracting("details").isEqualTo(java.util.List.of(
                        "customerId: Customer ID must be 9 digits."));
        assertThatThrownBy(() -> new Customer("ABCDEFGHI", details().build()))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void requiresFirstAndLastNameWithLettersAndSpacesOnly() {
        assertThatThrownBy(() -> new Customer("000000001", details().firstName(" ").build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("First Name must be supplied.");
        assertThatThrownBy(() -> new Customer("000000001", details().lastName("Kessler1").build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("Last Name can contain only alphabetic characters and spaces.");
        assertThatThrownBy(() -> new Customer("000000001",
                details().lastName("A".repeat(26)).build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("Last Name must be 25 characters or fewer.");
        assertThat(new Customer("000000001", details().lastName("Van Der Berg").build())
                .getLastName()).isEqualTo("Van Der Berg");
    }

    @Test
    void allowsEmptyMiddleNameButRejectsInvalidOne() {
        assertThat(new Customer("000000001", details().middleName(null).build()).getMiddleName())
                .isNull();
        assertThat(new Customer("000000001", details().middleName("  ").build()).getMiddleName())
                .isNull();
        assertThatThrownBy(() -> new Customer("000000001", details().middleName("M4rie").build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("Middle Name can contain only alphabetic characters and spaces.");
    }

    @Test
    void requiresAddressLine1AndCity() {
        assertThatThrownBy(() -> new Customer("000000001", details().addressLine1("").build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("Address Line 1 must be supplied.");
        assertThatThrownBy(() -> new Customer("000000001", details().addressLine1("618 @ Route").build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("Address Line 1 can contain only alphabetic characters, digits, spaces and . # -");
        assertThatThrownBy(() -> new Customer("000000001", details().addressLine3("Springfield 2").build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("City can contain only alphabetic characters and spaces.");
        assertThatThrownBy(() -> new Customer("000000001", details().addressLine3(null).build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("City must be supplied.");
    }

    @Test
    void acceptsCityUpToFiftyCharacters() {
        String longCity = "A".repeat(50);

        assertThat(new Customer("000000001", details().addressLine3(longCity).build())
                .getAddressLine3()).isEqualTo(longCity);
        assertThatThrownBy(() -> new Customer("000000001",
                details().addressLine3("A".repeat(51)).build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("City must be 50 characters or fewer.");
    }

    @Test
    void acceptsAddressLine1WithLegacyPunctuation() {
        Customer customer = new Customer("000000001",
                details().addressLine1("618 Deshaun Route #12-Apt. 3").build());

        assertThat(customer.getAddressLine1()).isEqualTo("618 Deshaun Route #12-Apt. 3");
    }

    @Test
    void validatesStateCodeAgainstUspsList() {
        assertThat(new Customer("000000001", details().stateCode("DC").build()).getStateCode())
                .isEqualTo("DC");
        assertThat(new Customer("000000001", details().stateCode("PR").build()).getStateCode())
                .isEqualTo("PR");
        assertThatThrownBy(() -> new Customer("000000001", details().stateCode("ZZ").build()))
                .isInstanceOf(ValidationException.class)
                .extracting("details").isEqualTo(java.util.List.of(
                        "stateCode: State: is not a valid state code."));
    }

    @Test
    void requiresThreeLetterCountryCode() {
        assertThatThrownBy(() -> new Customer("000000001", details().countryCode("US").build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("Country must be 3 alphabetic characters.");
        assertThatThrownBy(() -> new Customer("000000001", details().countryCode("USA1").build()))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void requiresFiveDigitNonZeroZipCode() {
        assertThatThrownBy(() -> new Customer("000000001", details().zipCode("1000").build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("Zip code must be 5 digits.");
        assertThatThrownBy(() -> new Customer("000000001", details().zipCode("00000").build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("Zip code cannot be zero.");
    }

    @Test
    void allowsOptionalPhonesButValidatesFormatWhenPresent() {
        assertThat(new Customer("000000001", details().phoneNumber2(null).build()).getPhoneNumber2())
                .isNull();
        assertThatThrownBy(() -> new Customer("000000001", details().phoneNumber1("212555010").build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("Phone Number 1 must be 10 digits.");
        assertThatThrownBy(() -> new Customer("000000001", details().phoneNumber1("1125550101").build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("Phone Number 1 area code must start with a digit between 2 and 9.");
        assertThatThrownBy(() -> new Customer("000000001", details().phoneNumber2("2120000101").build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("Phone Number 2 exchange code cannot be 000.");
    }

    @Test
    void rejectsSsnWithReservedFirstSegment() {
        assertThatThrownBy(() -> new Customer("000000001", details().ssn("000123456").build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("SSN first 3 digits cannot be 000, 666 or 900-999.");
        assertThatThrownBy(() -> new Customer("000000001", details().ssn("666123456").build()))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> new Customer("000000001", details().ssn("900123456").build()))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> new Customer("000000001", details().ssn("12345678").build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("SSN must be 9 digits.");
        assertThatThrownBy(() -> new Customer("000000001", details().ssn(null).build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("SSN must be supplied.");
    }

    @Test
    void rejectsFutureDateOfBirth() {
        assertThatThrownBy(() -> new Customer("000000001",
                details().dateOfBirth(LocalDate.now().plusDays(1)).build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("Date of Birth cannot be in the future.");
        assertThat(new Customer("000000001",
                details().dateOfBirth(LocalDate.now()).build()).getDateOfBirth())
                .isEqualTo(LocalDate.now());
    }

    @Test
    void validatesFicoScoreRange() {
        assertThat(new Customer("000000001", details().ficoScore(300).build()).getFicoScore())
                .isEqualTo(300);
        assertThat(new Customer("000000001", details().ficoScore(850).build()).getFicoScore())
                .isEqualTo(850);
        assertThatThrownBy(() -> new Customer("000000001", details().ficoScore(299).build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("FICO Score must be between 300 and 850.");
        assertThatThrownBy(() -> new Customer("000000001", details().ficoScore(851).build()))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> new Customer("000000001", details().ficoScore(null).build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("FICO Score must be supplied.");
    }

    @Test
    void validatesEftAccountId() {
        assertThatThrownBy(() -> new Customer("000000001",
                details().eftAccountId("0000000000").build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("EFT Account ID cannot be zero.");
        assertThatThrownBy(() -> new Customer("000000001", details().eftAccountId("12345").build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("EFT Account ID must be 10 digits.");
    }

    @Test
    void validatesPrimaryCardHolderFlag() {
        assertThatThrownBy(() -> new Customer("000000001", details().primaryCardHolder("X").build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("Primary Card Holder must be Y or N.");
        assertThat(new Customer("000000001", details().primaryCardHolder("n").build())
                .getPrimaryCardHolder()).isEqualTo("N");
    }

    @Test
    void updateKeepsSsnWhenOmitted() {
        Customer customer = new Customer("000000001", details().build());

        customer.applyDetails(details().ssn(null).lastName("Kessler Smith").build());

        assertThat(customer.getLastName()).isEqualTo("Kessler Smith");
        assertThat(customer.getSsn()).isEqualTo(VALID_SSN);
    }

    @Test
    void failedUpdateLeavesPreviousValuesUntouched() {
        Customer customer = new Customer("000000001", details().build());

        assertThatThrownBy(() -> customer.applyDetails(
                details().firstName("Changed").stateCode("ZZ").build()))
                .isInstanceOf(ValidationException.class);

        assertThat(customer.getFirstName()).isEqualTo("Immanuel");
        assertThat(customer.getStateCode()).isEqualTo("NY");
    }

    private static DetailsBuilder details() {
        return new DetailsBuilder();
    }

    private static final class DetailsBuilder {

        private String firstName = "Immanuel";
        private String middleName = "Madeline";
        private String lastName = "Kessler";
        private String addressLine1 = "618 Deshaun Route";
        private String addressLine2 = "Apt. 802";
        private String addressLine3 = "Altenwerthshire";
        private String stateCode = "NY";
        private String countryCode = "USA";
        private String zipCode = "10001";
        private String phoneNumber1 = "(212)555-0101";
        private String phoneNumber2 = null;
        private String ssn = VALID_SSN;
        private LocalDate dateOfBirth = LocalDate.of(1985, 4, 12);
        private String eftAccountId = "0000000001";
        private String primaryCardHolder = "Y";
        private Integer ficoScore = 720;

        DetailsBuilder firstName(String value) {
            this.firstName = value;
            return this;
        }

        DetailsBuilder middleName(String value) {
            this.middleName = value;
            return this;
        }

        DetailsBuilder lastName(String value) {
            this.lastName = value;
            return this;
        }

        DetailsBuilder addressLine1(String value) {
            this.addressLine1 = value;
            return this;
        }

        DetailsBuilder addressLine3(String value) {
            this.addressLine3 = value;
            return this;
        }

        DetailsBuilder stateCode(String value) {
            this.stateCode = value;
            return this;
        }

        DetailsBuilder countryCode(String value) {
            this.countryCode = value;
            return this;
        }

        DetailsBuilder zipCode(String value) {
            this.zipCode = value;
            return this;
        }

        DetailsBuilder phoneNumber1(String value) {
            this.phoneNumber1 = value;
            return this;
        }

        DetailsBuilder phoneNumber2(String value) {
            this.phoneNumber2 = value;
            return this;
        }

        DetailsBuilder ssn(String value) {
            this.ssn = value;
            return this;
        }

        DetailsBuilder dateOfBirth(LocalDate value) {
            this.dateOfBirth = value;
            return this;
        }

        DetailsBuilder eftAccountId(String value) {
            this.eftAccountId = value;
            return this;
        }

        DetailsBuilder primaryCardHolder(String value) {
            this.primaryCardHolder = value;
            return this;
        }

        DetailsBuilder ficoScore(Integer value) {
            this.ficoScore = value;
            return this;
        }

        CustomerDetails build() {
            return new CustomerDetails(firstName, middleName, lastName, addressLine1, addressLine2,
                    addressLine3, stateCode, countryCode, zipCode, phoneNumber1, phoneNumber2, ssn,
                    dateOfBirth, eftAccountId, primaryCardHolder, ficoScore);
        }
    }
}
