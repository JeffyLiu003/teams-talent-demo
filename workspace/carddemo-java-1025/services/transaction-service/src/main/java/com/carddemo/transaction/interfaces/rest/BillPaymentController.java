package com.carddemo.transaction.interfaces.rest;

import com.carddemo.transaction.application.BillPaymentService;
import com.carddemo.transaction.interfaces.rest.dto.BillPaymentRequest;
import com.carddemo.transaction.interfaces.rest.dto.BillPaymentResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "账单支付", description = "全额还款（遗留 COBIL00C）")
@RestController
@RequestMapping("/api/v1/bill-payments")
public class BillPaymentController {

    private final BillPaymentService billPaymentService;

    public BillPaymentController(BillPaymentService billPaymentService) {
        this.billPaymentService = billPaymentService;
    }

    @Operation(summary = "账单支付",
            description = "金额恒等于账户当前余额；余额 ≤ 0 返回 409 NOTHING_TO_PAY；confirm=false 返回 409 CONFIRMATION_REQUIRED。")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(examples = @ExampleObject(
            name = "账户 1 全额还款（余额 1940.00）",
            value = """
                    {"accountId":"00000000001","confirm":true}
                    """)))
    @PostMapping
    public BillPaymentResponse pay(@Valid @RequestBody BillPaymentRequest request) {
        return BillPaymentResponse.from(
                billPaymentService.pay(request.accountId(), Boolean.TRUE.equals(request.confirm())));
    }
}
