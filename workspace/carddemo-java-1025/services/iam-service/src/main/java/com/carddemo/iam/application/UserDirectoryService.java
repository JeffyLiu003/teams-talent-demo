package com.carddemo.iam.application;

import com.carddemo.iam.domain.exception.BusinessRuleException;
import com.carddemo.iam.domain.exception.NotFoundException;
import com.carddemo.iam.domain.exception.ValidationException;
import com.carddemo.iam.domain.model.User;
import com.carddemo.iam.domain.model.UserDetails;
import com.carddemo.iam.domain.repository.UserRepository;
import com.carddemo.iam.domain.security.PasswordHasher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 用户目录用例。对应遗留程序 COUSR00C（列表）、COUSR01C（新增）、
 * COUSR02C（修改）、COUSR03C（删除）。
 */
@Service
@Transactional
public class UserDirectoryService {

    private static final int DEFAULT_PAGE_SIZE = 10;
    private static final int MAX_PAGE_SIZE = 100;

    private final UserRepository users;
    private final PasswordHasher passwordHasher;

    public UserDirectoryService(UserRepository users, PasswordHasher passwordHasher) {
        this.users = users;
        this.passwordHasher = passwordHasher;
    }

    /**
     * BR-USER-05：按用户号升序分页，默认每页 10 条。
     */
    @Transactional(readOnly = true)
    public PageResult<User> list(int page, int size) {
        int safePage = page < 0 ? 0 : page;
        int safeSize = size <= 0 ? DEFAULT_PAGE_SIZE : Math.min(size, MAX_PAGE_SIZE);
        return new PageResult<>(users.findAllUsers(safePage, safeSize), safePage, safeSize,
                users.countUsers());
    }

    @Transactional(readOnly = true)
    public User get(String rawUserId) {
        String userId = requireUserId(rawUserId);
        return users.findByUserId(userId)
                .orElseThrow(() -> new NotFoundException("USER_NOT_FOUND",
                        "User " + userId + " not found"));
    }

    /**
     * BR-USER-01..04：新增用户；用户号重复 → 409 USER_ALREADY_EXISTS。
     */
    public User create(String rawUserId, UserDetails details, String password) {
        User user = new User(rawUserId, details, passwordHasher.hash(requirePassword(password)));
        if (users.existsByUserId(user.getUserId())) {
            throw new BusinessRuleException("USER_ALREADY_EXISTS",
                    "User " + user.getUserId() + " already exists");
        }
        return users.saveUser(user);
    }

    /**
     * BR-USER-06：修改用户，password 缺省表示保持不变；
     * NR-USER-01：不允许把最后一个管理员降级为普通用户。
     */
    public User update(String rawUserId, UserDetails details, String password) {
        User user = get(rawUserId);
        boolean demotingAdmin = user.isAdmin()
                && !User.TYPE_ADMIN.equals(details == null ? null : details.userType());
        if (demotingAdmin && isLastAdmin()) {
            throw new BusinessRuleException("LAST_ADMIN",
                    "Cannot demote the last administrator of the system.");
        }
        user.applyDetails(details);
        if (password != null) {
            user.changePassword(passwordHasher.hash(requirePassword(password)));
        }
        return users.saveUser(user);
    }

    /**
     * NR-USER-01/02：禁止删除自己、禁止删除最后一个管理员。
     */
    public void delete(String rawUserId, String actingUserId) {
        User user = get(rawUserId);
        String actor = User.normalizeUserId(actingUserId);
        if (actor != null && actor.equals(user.getUserId())) {
            throw new BusinessRuleException("CANNOT_DELETE_SELF",
                    "You cannot delete your own user record.");
        }
        if (user.isAdmin() && isLastAdmin()) {
            throw new BusinessRuleException("LAST_ADMIN",
                    "Cannot delete the last administrator of the system.");
        }
        users.deleteUser(user.getUserId());
    }

    private boolean isLastAdmin() {
        return users.countByUserType(User.TYPE_ADMIN) <= 1;
    }

    private static String requireUserId(String rawUserId) {
        String userId = User.normalizeUserId(rawUserId);
        if (userId == null || userId.isEmpty()) {
            throw new ValidationException("userId", "User ID must be supplied.");
        }
        return userId;
    }

    /**
     * BR-USER-03：密码 8-64 位，前后空白去掉后保存（登录同样 trim，见 ADR-008）。
     */
    private static String requirePassword(String password) {
        if (password == null || password.isBlank()) {
            throw new ValidationException("password", "Password must be supplied.");
        }
        String value = password.trim();
        if (value.length() < 8 || value.length() > 64) {
            throw new ValidationException("password", "Password must be 8 to 64 characters.");
        }
        return value;
    }
}
