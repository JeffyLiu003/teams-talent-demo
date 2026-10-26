package com.carddemo.iam.interfaces.rest;

import com.carddemo.iam.application.PageResult;
import com.carddemo.iam.application.UserDirectoryService;
import com.carddemo.iam.domain.model.User;
import com.carddemo.iam.interfaces.rest.dto.CreateUserRequest;
import com.carddemo.iam.interfaces.rest.dto.PageResponse;
import com.carddemo.iam.interfaces.rest.dto.UpdateUserRequest;
import com.carddemo.iam.interfaces.rest.dto.UserResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private static final String ACTING_USER_HEADER = "X-User-Id";

    private final UserDirectoryService userService;

    public UserController(UserDirectoryService userService) {
        this.userService = userService;
    }

    @GetMapping
    public PageResponse<UserResponse> list(@RequestParam(defaultValue = "0") int page,
                                           @RequestParam(defaultValue = "10") int size) {
        PageResult<User> result = userService.list(page, size);
        List<UserResponse> items = result.items().stream().map(UserResponse::from).toList();
        return new PageResponse<>(items, result.page(), result.size(), result.total());
    }

    @GetMapping("/{userId}")
    public UserResponse get(@PathVariable String userId) {
        return UserResponse.from(userService.get(userId));
    }

    @PostMapping
    public ResponseEntity<UserResponse> create(@Valid @RequestBody CreateUserRequest request) {
        User created = userService.create(request.userId(), request.toDetails(), request.password());
        return ResponseEntity.status(HttpStatus.CREATED).body(UserResponse.from(created));
    }

    @PutMapping("/{userId}")
    public UserResponse update(@PathVariable String userId,
                               @Valid @RequestBody UpdateUserRequest request) {
        return UserResponse.from(userService.update(userId, request.toDetails(), request.password()));
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> delete(@PathVariable String userId,
                                       @RequestHeader(name = ACTING_USER_HEADER, required = false)
                                       String actingUserId) {
        userService.delete(userId, actingUserId);
        return ResponseEntity.noContent().build();
    }
}
