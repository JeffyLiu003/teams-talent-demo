package com.carddemo.iam.interfaces.rest;

import com.carddemo.iam.application.AuthenticationService;
import com.carddemo.iam.interfaces.rest.dto.LoginRequest;
import com.carddemo.iam.interfaces.rest.dto.LoginResponse;
import com.carddemo.iam.interfaces.rest.dto.VerifyTokenRequest;
import com.carddemo.iam.interfaces.rest.dto.VerifyTokenResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "认证", description = "登录与 token 校验")
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthenticationService authenticationService;

    public AuthController(AuthenticationService authenticationService) {
        this.authenticationService = authenticationService;
    }

    @Operation(summary = "登录（演示账号已预填：ADMIN001 / admin123）",
            description = "用户号忽略大小写；失败统一返回 401 INVALID_CREDENTIALS。"
                    + "普通用户演示账号：USER0001 / user1234。")
    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return LoginResponse.from(authenticationService.login(request.userId(), request.password()));
    }

    @Operation(summary = "校验 token", description = "签名错误或过期时返回 valid=false，不抛 401。")
    @PostMapping("/verify")
    public VerifyTokenResponse verify(@Valid @RequestBody VerifyTokenRequest request) {
        return VerifyTokenResponse.from(authenticationService.verify(request.token()));
    }
}
