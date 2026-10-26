package com.carddemo.transaction.interfaces.rest;

import com.carddemo.transaction.application.PostingCommand;
import com.carddemo.transaction.interfaces.rest.dto.PostingRequest;
import com.carddemo.transaction.interfaces.rest.dto.PostingResultResponse;
import com.carddemo.transaction.application.PostingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "入账", description = "日终入账（遗留 CBTRN02C）")
@RestController
@RequestMapping("/api/v1/postings")
public class PostingController {

    private final PostingService postingService;

    public PostingController(PostingService postingService) {
        this.postingService = postingService;
    }

    @Operation(summary = "批量入账",
            description = "校验卡号/账户/额度/账户有效期；通过后更新类别累计、调用账户记账并写交易。"
                    + "单笔拒付不中断整批；同一交易号重复提交幂等。")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(examples = @ExampleObject(
            name = "单笔入账（卡 3344556677889900 → 账户 6）",
            value = """
                    {"transactions":[{"transactionId":"0000000000000100","cardNumber":"3344556677889900",
                    "typeCode":"01","categoryCode":"0001","source":"POS TERM",
                    "description":"Purchase at Smoke Test","amount":25.00,
                    "originalTimestamp":"2026-10-25T10:15:00","merchantId":"800000001",
                    "merchantName":"Smoke Test","merchantCity":"Springfield","merchantZip":"10001"}]}
                    """)))
    @PostMapping
    public PostingResultResponse post(@Valid @RequestBody PostingRequest request) {
        List<PostingCommand> commands = request.transactions().stream()
                .map(command -> command.toCommand())
                .toList();
        return PostingResultResponse.from(postingService.post(commands));
    }
}
