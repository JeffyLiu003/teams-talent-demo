package com.carddemo.transaction.interfaces.rest;

import com.carddemo.transaction.application.TransactionApplicationService;
import com.carddemo.transaction.application.TransactionView;
import com.carddemo.transaction.domain.repository.PageResult;
import com.carddemo.transaction.interfaces.rest.dto.CreateTransactionRequest;
import com.carddemo.transaction.interfaces.rest.dto.TransactionListResponse;
import com.carddemo.transaction.interfaces.rest.dto.TransactionResponse;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "交易", description = "交易录入与查询（遗留 COTRN00C/01C/02C）")
@RestController
@RequestMapping("/api/v1/transactions")
public class TransactionController {

    private final TransactionApplicationService transactionService;

    public TransactionController(TransactionApplicationService transactionService) {
        this.transactionService = transactionService;
    }

    @GetMapping
    public TransactionListResponse list(@RequestParam(required = false) String idPrefix,
                                        @RequestParam(required = false) String cardNumber,
                                        @RequestParam(required = false) String accountId,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "10") int size) {
        int safePage = Math.max(page, 0);
        int safeSize = size <= 0 ? 10 : size;
        PageResult<TransactionView> result = transactionService.list(idPrefix, cardNumber, accountId,
                safePage, safeSize);
        return TransactionListResponse.from(result, safePage, safeSize);
    }

    @GetMapping("/{transactionId}")
    public TransactionResponse get(@PathVariable String transactionId) {
        return TransactionResponse.from(transactionService.get(transactionId));
    }

    @Operation(summary = "交易录入",
            description = "账户号或卡号至少一个；交易号取当前最大值 +1（16 位）。卡号示例对应账户 2。")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(examples = @ExampleObject(
            name = "按卡号录入（卡 0683586198171516 → 账户 2）",
            value = """
                    {"accountId":"00000000002","cardNumber":"0683586198171516","typeCode":"01",
                    "categoryCode":"0001","source":"POS TERM","description":"Purchase at Test Merchant",
                    "amount":25.99,"originalDate":"2026-10-25","processedDate":"2026-10-25",
                    "merchantId":"800000123","merchantName":"Test Merchant",
                    "merchantCity":"Springfield","merchantZip":"10001"}
                    """)))
    @PostMapping
    public ResponseEntity<TransactionResponse> create(@Valid @RequestBody CreateTransactionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(TransactionResponse.from(transactionService.create(request.toCommand())));
    }
}
