package com.carddemo.iam.domain.model;

import com.carddemo.iam.domain.exception.ValidationException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * 用户聚合根。对应遗留安全文件 USRSEC，记录布局见 copybook CSUSR01Y。
 * <p>
 * BR-SGN-02：用户号比较前统一 trim + 大写（密码不转换，见 ADR-008）。
 * BR-SGN-04/05：仅 {@code userType = 'A'} 进入管理员菜单。
 */
@Entity
@Table(name = "sec_user")
public class User {

    public static final int USER_ID_LENGTH = 8;
    public static final int NAME_MAX_LENGTH = 20;
    public static final String TYPE_ADMIN = "A";
    public static final String TYPE_USER = "U";

    private static final Pattern USER_ID_PATTERN = Pattern.compile("^[A-Z0-9]{8}$");

    @Id
    @Column(name = "user_id", length = USER_ID_LENGTH, nullable = false, updatable = false)
    private String userId;

    @Column(name = "first_name", length = NAME_MAX_LENGTH, nullable = false)
    private String firstName;

    @Column(name = "last_name", length = NAME_MAX_LENGTH, nullable = false)
    private String lastName;

    @Column(name = "password_hash", length = 200, nullable = false)
    private String passwordHash;

    @Column(name = "user_type", length = 1, nullable = false)
    private String userType;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected User() {
        // for JPA
    }

    public User(String userId, UserDetails details, String passwordHash) {
        this.userId = requireUserId(userId);
        if (passwordHash == null || passwordHash.isBlank()) {
            throw new ValidationException("password", "Password must be supplied.");
        }
        this.passwordHash = passwordHash;
        applyDetails(details);
        this.version = 0;
    }

    /**
     * BR-SGN-02：用户号 trim + 大写，其余字符原样保留。
     */
    public static String normalizeUserId(String rawUserId) {
        return rawUserId == null ? null : rawUserId.trim().toUpperCase(Locale.ROOT);
    }

    /**
     * BR-USER-01/04：姓名必填且 1-20 位，用户类型仅 A/U。
     */
    public void applyDetails(UserDetails details) {
        if (details == null) {
            throw new ValidationException("firstName", "First Name must be supplied.");
        }
        this.firstName = requireName(details.firstName(), "firstName", "First Name");
        this.lastName = requireName(details.lastName(), "lastName", "Last Name");
        this.userType = requireUserType(details.userType());
    }

    /**
     * BR-USER-03：密码只保存 PBKDF2 哈希，从不落明文。
     */
    public void changePassword(String passwordHash) {
        if (passwordHash == null || passwordHash.isBlank()) {
            throw new ValidationException("password", "Password must be supplied.");
        }
        this.passwordHash = passwordHash;
    }

    public boolean isAdmin() {
        return TYPE_ADMIN.equals(userType);
    }

    /**
     * BR-SGN-04/05：管理员进入 ADMIN 菜单，其余一律按普通用户处理。
     */
    public String landingMenu() {
        return isAdmin() ? "ADMIN" : "USER";
    }

    private static String requireUserId(String rawUserId) {
        String normalized = normalizeUserId(rawUserId);
        if (normalized == null || !USER_ID_PATTERN.matcher(normalized).matches()) {
            throw new ValidationException("userId", "User ID must be 8 alphanumeric characters.");
        }
        return normalized;
    }

    private static String requireName(String rawValue, String field, String label) {
        String value = rawValue == null ? "" : rawValue.trim();
        if (value.isEmpty()) {
            throw new ValidationException(field, label + " must be supplied.");
        }
        if (value.length() > NAME_MAX_LENGTH) {
            throw new ValidationException(field, label + " must be " + NAME_MAX_LENGTH
                    + " characters or fewer.");
        }
        return value;
    }

    private static String requireUserType(String rawValue) {
        String value = rawValue == null ? "" : rawValue.trim().toUpperCase(Locale.ROOT);
        if (!TYPE_ADMIN.equals(value) && !TYPE_USER.equals(value)) {
            throw new ValidationException("userType", "User Type must be A or U.");
        }
        return value;
    }

    public String getUserId() {
        return userId;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getUserType() {
        return userType;
    }

    public long getVersion() {
        return version;
    }
}
