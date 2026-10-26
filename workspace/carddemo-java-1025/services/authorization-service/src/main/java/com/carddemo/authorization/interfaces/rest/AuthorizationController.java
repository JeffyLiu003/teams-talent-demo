package com.carddemo.authorization.interfaces.rest;

import com.carddemo.authorization.application.AuthorizationResult;
import com.carddemo.authorization.application.AuthorizationService;
import com.carddemo.authorization.application.FraudResult;
import com.carddemo.authorization.application.PurgeResult;
import com.carddemo.authorization.domain.repository.PageResult;
import com.carddemo.authorization.domain.model.AuthorizationCase;
import com.carddemo.authorization.interfaces.rest.dto.AuthorizationDetailResponse;
import com.carddemo.authorization.interfaces.rest.dto.AuthorizationListResponse;
import com.carddemo.authorization.interfaces.rest.dto.CreateAuthorizationRequest;
import com.carddemo.authorization.interfaces.rest.dto.PendingAuthorizationResponse;
import com.carddemo.authorization.interfaces.rest.dto.PurgeRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 授权上下文入站适配器。契约见 docs/design/05-api-catalog.md §6。
 */
@Tag(name = "授权", description = "授权决策、待授权汇总、欺诈标记与过期清理（遗留 COPAUA0C/COPAUS*/CBPAUP0C）")
@RestController
public class AuthorizationController {

    private final AuthorizationService authorizationService;

    public AuthorizationController(AuthorizationService authorizationService) {
        this.authorizationService = authorizationService;
    }

    @Operation(summary = "授权决策",
            description = "卡 0500024453765740 → 账户 1（额度 2020、余额 1940 → 可用 80）。"
                    + "原因码优先级：3100 不存在 > 4100 额度不足 > 4200 卡未激活 > 4300 账户关闭 > 5100 卡欺诈。")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(examples = @ExampleObject(
            name = "授权 50.00（应批准）",
            value = """
                    {"cardNumber":"0500024453765740","transactionAmount":50.00,"authType":"01",
                    "cardExpiryDate":"2805","messageType":"0100","messageSource":"POS",
                    "processingCode":"000000","merchantCategoryCode":"5411","acquirerCountryCode":"USA",
                    "posEntryMode":5,"merchantId":"MERCHANT0000001","merchantName":"Corner Grocery",
                    "merchantCity":"Springfield","merchantState":"IL","merchantZip":"62704",
                    "transactionId":"TXN000000000001","authTimestamp":"2026-10-25T10:15:00"}
                    """)))
    @PostMapping("/api/v1/authorizations")
    public ResponseEntity<AuthorizationResult> authorize(
            @Valid @RequestBody CreateAuthorizationRequest request) {
        AuthorizationResult result = authorizationService.authorize(request.toCommand());
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @GetMapping("/api/v1/authorizations")
    public AuthorizationListResponse list(@RequestParam String accountId,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "10") int size) {
        PageResult<AuthorizationCase> result = authorizationService.list(accountId, page, size);
        return AuthorizationListResponse.from(result, page, size);
    }

    @GetMapping("/api/v1/authorizations/{authorizationId}")
    public AuthorizationDetailResponse get(@PathVariable String authorizationId) {
        return AuthorizationDetailResponse.from(authorizationService.getDetail(authorizationId));
    }

    @GetMapping("/api/v1/pending-authorizations/{accountId}")
    public PendingAuthorizationResponse pending(@PathVariable String accountId) {
        return PendingAuthorizationResponse.from(authorizationService.getSummary(accountId));
    }

    @PostMapping("/api/v1/authorizations/{authorizationId}/fraud")
    public FraudResult markFraud(@PathVariable String authorizationId) {
        return authorizationService.markFraud(authorizationId);
    }

    @PostMapping("/api/v1/authorization-purges")
    public PurgeResult purge(@Valid @RequestBody(required = false) PurgeRequest request) {
        return authorizationService.purge(request == null ? null : request.expiryDays());
    }
}
