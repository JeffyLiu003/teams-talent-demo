package com.carddemo.customer.domain.model;

import com.carddemo.customer.domain.exception.ValidationException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.LocalDate;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 客户聚合根。对应遗留 VSAM 文件 CUSTDAT，记录布局见 copybook CVCUS01Y（RECLN 500）。
 * <p>
 * 字段校验规则来自 COACTUPC 的 1500/2000 段（BR-CUST-01..11）。
 */
@Entity
@Table(name = "customer")
public class Customer {

    public static final int CUSTOMER_ID_LENGTH = 9;
    public static final int NAME_MAX_LENGTH = 25;
    public static final int ADDRESS_MAX_LENGTH = 50;

    /**
     * BR-CUST-04：50 州 + DC + PR + VI + GU + AS + MP。
     */
    private static final Set<String> STATE_CODES = Set.of(
            "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
            "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
            "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
            "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
            "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
            "DC", "PR", "VI", "GU", "AS", "MP");

    private static final Pattern CUSTOMER_ID_PATTERN = Pattern.compile("^\\d{9}$");
    private static final Pattern LETTERS_AND_SPACES = Pattern.compile("^[A-Za-z][A-Za-z ]*$");
    private static final Pattern ADDRESS_LINE_1 = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9 .#-]*$");
    private static final Pattern COUNTRY_CODE = Pattern.compile("^[A-Za-z]{3}$");
    private static final Pattern ZIP_CODE = Pattern.compile("^\\d{5}$");
    private static final Pattern SSN = Pattern.compile("^\\d{9}$");
    private static final Pattern EFT_ACCOUNT_ID = Pattern.compile("^\\d{10}$");

    @Id
    @Column(name = "customer_id", length = CUSTOMER_ID_LENGTH, nullable = false, updatable = false)
    private String customerId;

    @Column(name = "first_name", length = NAME_MAX_LENGTH, nullable = false)
    private String firstName;

    @Column(name = "middle_name", length = NAME_MAX_LENGTH)
    private String middleName;

    @Column(name = "last_name", length = NAME_MAX_LENGTH, nullable = false)
    private String lastName;

    @Column(name = "address_line1", length = ADDRESS_MAX_LENGTH, nullable = false)
    private String addressLine1;

    @Column(name = "address_line2", length = ADDRESS_MAX_LENGTH)
    private String addressLine2;

    @Column(name = "address_line3", length = ADDRESS_MAX_LENGTH, nullable = false)
    private String addressLine3;

    @Column(name = "state_code", length = 2, nullable = false)
    private String stateCode;

    @Column(name = "country_code", length = 3, nullable = false)
    private String countryCode;

    @Column(name = "zip_code", length = 10, nullable = false)
    private String zipCode;

    @Column(name = "phone_number1", length = 15)
    private String phoneNumber1;

    @Column(name = "phone_number2", length = 15)
    private String phoneNumber2;

    @Column(name = "ssn", length = 9, nullable = false)
    private String ssn;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(name = "eft_account_id", length = 10, nullable = false)
    private String eftAccountId;

    @Column(name = "primary_card_holder", length = 1, nullable = false)
    private String primaryCardHolder;

    @Column(name = "fico_score", nullable = false)
    private Integer ficoScore;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected Customer() {
        // for JPA
    }

    public Customer(String customerId, CustomerDetails details) {
        this.customerId = requireCustomerId(customerId);
        if (details == null || details.ssn() == null || details.ssn().isBlank()) {
            throw new ValidationException("ssn", "SSN must be supplied.");
        }
        applyDetails(details);
        this.version = 0;
    }

    /**
     * BR-CUST-02..11：全部字段先校验后落值，避免校验失败留下半更新状态。
     * {@code ssn} 为 null 表示保持不变。
     */
    public void applyDetails(CustomerDetails details) {
        if (details == null) {
            throw new ValidationException("customerId", "Customer details must be supplied.");
        }
        String newFirstName = requireName(details.firstName(), "firstName", "First Name");
        String newMiddleName = optionalName(details.middleName(), "middleName", "Middle Name");
        String newLastName = requireName(details.lastName(), "lastName", "Last Name");
        String newAddressLine1 = requireAddressLine1(details.addressLine1());
        String newAddressLine2 = optionalAddressLine2(details.addressLine2());
        String newAddressLine3 = requireName(details.addressLine3(), "addressLine3", "City",
                ADDRESS_MAX_LENGTH);
        String newStateCode = requireStateCode(details.stateCode());
        String newCountryCode = requireCountryCode(details.countryCode());
        String newZipCode = requireZipCode(details.zipCode());
        String newPhoneNumber1 = normalizePhone(details.phoneNumber1(), "phoneNumber1", "Phone Number 1");
        String newPhoneNumber2 = normalizePhone(details.phoneNumber2(), "phoneNumber2", "Phone Number 2");
        String newSsn = details.ssn() == null || details.ssn().isBlank() ? null : requireSsn(details.ssn());
        LocalDate newDateOfBirth = requireDateOfBirth(details.dateOfBirth());
        String newEftAccountId = requireEftAccountId(details.eftAccountId());
        String newPrimaryCardHolder = requirePrimaryCardHolder(details.primaryCardHolder());
        Integer newFicoScore = requireFicoScore(details.ficoScore());

        this.firstName = newFirstName;
        this.middleName = newMiddleName;
        this.lastName = newLastName;
        this.addressLine1 = newAddressLine1;
        this.addressLine2 = newAddressLine2;
        this.addressLine3 = newAddressLine3;
        this.stateCode = newStateCode;
        this.countryCode = newCountryCode;
        this.zipCode = newZipCode;
        this.phoneNumber1 = newPhoneNumber1;
        this.phoneNumber2 = newPhoneNumber2;
        if (newSsn != null) {
            this.ssn = newSsn;
        }
        this.dateOfBirth = newDateOfBirth;
        this.eftAccountId = newEftAccountId;
        this.primaryCardHolder = newPrimaryCardHolder;
        this.ficoScore = newFicoScore;
    }

    /**
     * BR-CUST-07：响应中只暴露掩码 {@code ***-**-1234}。
     */
    public String maskedSsn() {
        return "***-**-" + ssn.substring(5);
    }

    private static String requireCustomerId(String rawValue) {
        String value = rawValue == null ? "" : rawValue.trim();
        if (value.isEmpty()) {
            throw new ValidationException("customerId", "Customer ID must be supplied.");
        }
        if (!CUSTOMER_ID_PATTERN.matcher(value).matches()) {
            throw new ValidationException("customerId", "Customer ID must be 9 digits.");
        }
        return value;
    }

    private static String requireName(String rawValue, String field, String label) {
        return requireName(rawValue, field, label, NAME_MAX_LENGTH);
    }

    private static String requireName(String rawValue, String field, String label, int maxLength) {
        String value = rawValue == null ? "" : rawValue.trim();
        if (value.isEmpty()) {
            throw new ValidationException(field, label + " must be supplied.");
        }
        if (value.length() > maxLength) {
            throw new ValidationException(field,
                    label + " must be " + maxLength + " characters or fewer.");
        }
        if (!LETTERS_AND_SPACES.matcher(value).matches()) {
            throw new ValidationException(field,
                    label + " can contain only alphabetic characters and spaces.");
        }
        return value;
    }

    private static String optionalName(String rawValue, String field, String label) {
        if (rawValue == null || rawValue.isBlank()) {
            return null;
        }
        return requireName(rawValue, field, label);
    }

    private static String requireAddressLine1(String rawValue) {
        String value = rawValue == null ? "" : rawValue.trim();
        String label = "Address Line 1";
        if (value.isEmpty()) {
            throw new ValidationException("addressLine1", label + " must be supplied.");
        }
        if (value.length() > ADDRESS_MAX_LENGTH) {
            throw new ValidationException("addressLine1",
                    label + " must be " + ADDRESS_MAX_LENGTH + " characters or fewer.");
        }
        if (!ADDRESS_LINE_1.matcher(value).matches()) {
            throw new ValidationException("addressLine1",
                    label + " can contain only alphabetic characters, digits, spaces and . # -");
        }
        return value;
    }

    private static String optionalAddressLine2(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            return null;
        }
        String value = rawValue.trim();
        if (value.length() > ADDRESS_MAX_LENGTH) {
            throw new ValidationException("addressLine2",
                    "Address Line 2 must be " + ADDRESS_MAX_LENGTH + " characters or fewer.");
        }
        return value;
    }

    private static String requireStateCode(String rawValue) {
        String value = rawValue == null ? "" : rawValue.trim().toUpperCase(Locale.ROOT);
        if (value.isEmpty()) {
            throw new ValidationException("stateCode", "State must be supplied.");
        }
        if (!STATE_CODES.contains(value)) {
            throw new ValidationException("stateCode", "State: is not a valid state code.");
        }
        return value;
    }

    private static String requireCountryCode(String rawValue) {
        String value = rawValue == null ? "" : rawValue.trim().toUpperCase(Locale.ROOT);
        if (value.isEmpty()) {
            throw new ValidationException("countryCode", "Country must be supplied.");
        }
        if (!COUNTRY_CODE.matcher(value).matches()) {
            throw new ValidationException("countryCode",
                    "Country must be 3 alphabetic characters.");
        }
        return value;
    }

    private static String requireZipCode(String rawValue) {
        String value = rawValue == null ? "" : rawValue.trim();
        if (value.isEmpty()) {
            throw new ValidationException("zipCode", "Zip code must be supplied.");
        }
        if (!ZIP_CODE.matcher(value).matches()) {
            throw new ValidationException("zipCode", "Zip code must be 5 digits.");
        }
        if ("00000".equals(value)) {
            throw new ValidationException("zipCode", "Zip code cannot be zero.");
        }
        return value;
    }

    /**
     * BR-CUST-06：去掉非数字后必须 10 位，区号首位 2-9，交换码不得为 000；入库格式 {@code (999)999-9999}。
     */
    private static String normalizePhone(String rawValue, String field, String label) {
        if (rawValue == null || rawValue.isBlank()) {
            return null;
        }
        String digits = rawValue.replaceAll("\\D", "");
        if (digits.length() != 10) {
            throw new ValidationException(field, label + " must be 10 digits.");
        }
        char areaFirstDigit = digits.charAt(0);
        if (areaFirstDigit < '2' || areaFirstDigit > '9') {
            throw new ValidationException(field,
                    label + " area code must start with a digit between 2 and 9.");
        }
        if ("000".equals(digits.substring(3, 6))) {
            throw new ValidationException(field, label + " exchange code cannot be 000.");
        }
        return "(" + digits.substring(0, 3) + ")" + digits.substring(3, 6) + "-" + digits.substring(6);
    }

    /**
     * BR-CUST-07：9 位数字，首段不得为 000/666/900-999。
     */
    private static String requireSsn(String rawValue) {
        String value = rawValue == null ? "" : rawValue.trim();
        if (value.isEmpty()) {
            throw new ValidationException("ssn", "SSN must be supplied.");
        }
        if (!SSN.matcher(value).matches()) {
            throw new ValidationException("ssn", "SSN must be 9 digits.");
        }
        int firstSegment = Integer.parseInt(value.substring(0, 3));
        if (firstSegment == 0 || firstSegment == 666 || firstSegment >= 900) {
            throw new ValidationException("ssn",
                    "SSN first 3 digits cannot be 000, 666 or 900-999.");
        }
        return value;
    }

    /**
     * BR-CUST-09：出生日期不得晚于当天。
     */
    private static LocalDate requireDateOfBirth(LocalDate value) {
        if (value == null) {
            return null;
        }
        if (value.isAfter(LocalDate.now())) {
            throw new ValidationException("dateOfBirth", "Date of Birth cannot be in the future.");
        }
        return value;
    }

    /**
     * BR-CUST-10：10 位数字且非全零。
     */
    private static String requireEftAccountId(String rawValue) {
        String value = rawValue == null ? "" : rawValue.trim();
        if (value.isEmpty()) {
            throw new ValidationException("eftAccountId", "EFT Account ID must be supplied.");
        }
        if (!EFT_ACCOUNT_ID.matcher(value).matches()) {
            throw new ValidationException("eftAccountId", "EFT Account ID must be 10 digits.");
        }
        if (value.chars().allMatch(digit -> digit == '0')) {
            throw new ValidationException("eftAccountId", "EFT Account ID cannot be zero.");
        }
        return value;
    }

    /**
     * BR-CUST-11：主卡持有人标志仅 Y/N。
     */
    private static String requirePrimaryCardHolder(String rawValue) {
        String value = rawValue == null ? "" : rawValue.trim().toUpperCase(Locale.ROOT);
        if (!"Y".equals(value) && !"N".equals(value)) {
            throw new ValidationException("primaryCardHolder", "Primary Card Holder must be Y or N.");
        }
        return value;
    }

    /**
     * BR-CUST-08：FICO 300-850。
     */
    private static Integer requireFicoScore(Integer value) {
        if (value == null) {
            throw new ValidationException("ficoScore", "FICO Score must be supplied.");
        }
        if (value < 300 || value > 850) {
            throw new ValidationException("ficoScore", "FICO Score must be between 300 and 850.");
        }
        return value;
    }

    public String getCustomerId() {
        return customerId;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getMiddleName() {
        return middleName;
    }

    public String getLastName() {
        return lastName;
    }

    public String getAddressLine1() {
        return addressLine1;
    }

    public String getAddressLine2() {
        return addressLine2;
    }

    public String getAddressLine3() {
        return addressLine3;
    }

    public String getStateCode() {
        return stateCode;
    }

    public String getCountryCode() {
        return countryCode;
    }

    public String getZipCode() {
        return zipCode;
    }

    public String getPhoneNumber1() {
        return phoneNumber1;
    }

    public String getPhoneNumber2() {
        return phoneNumber2;
    }

    public String getSsn() {
        return ssn;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public String getEftAccountId() {
        return eftAccountId;
    }

    public String getPrimaryCardHolder() {
        return primaryCardHolder;
    }

    public Integer getFicoScore() {
        return ficoScore;
    }

    public long getVersion() {
        return version;
    }
}
