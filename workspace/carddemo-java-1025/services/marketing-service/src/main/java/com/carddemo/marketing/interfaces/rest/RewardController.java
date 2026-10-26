package com.carddemo.marketing.interfaces.rest;

import com.carddemo.marketing.application.MarketingQueryService;
import com.carddemo.marketing.application.RewardEvaluationService;
import com.carddemo.marketing.application.RewardView;
import com.carddemo.marketing.domain.repository.PageResult;
import com.carddemo.marketing.interfaces.rest.dto.EvaluationRequest;
import com.carddemo.marketing.interfaces.rest.dto.EvaluationResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "奖励", description = "奖励评估、发放记录与失败重试")
@RestController
public class RewardController {

    private final RewardEvaluationService evaluationService;
    private final MarketingQueryService queryService;

    public RewardController(RewardEvaluationService evaluationService,
                            MarketingQueryService queryService) {
        this.evaluationService = evaluationService;
        this.queryService = queryService;
    }

    @Operation(summary = "奖励评估",
            description = "交易入账成功后调用；按活动规则计算奖励并尝试返现入账。同一交易重复调用幂等。")
    @io.swagger.v3.oas.annotations.parameters.RequestBody(content = @Content(examples = @ExampleObject(
            name = "餐饮消费 120.00（卡 0500024453765740）",
            value = """
                    {"transactionId":"0000000000000200","cardNumber":"0500024453765740",
                    "accountId":"00000000001","customerId":"000000001","amount":120.00,
                    "categoryCode":"0001","typeCode":"01","description":"Dinner",
                    "processedAt":"2026-10-25T19:30:00"}
                    """)))
    @PostMapping("/api/v1/reward-evaluations")
    public EvaluationResponse evaluate(@Valid @RequestBody EvaluationRequest request) {
        return EvaluationResponse.from(evaluationService.evaluate(request.toCommand()));
    }

    @Operation(summary = "奖励记录", description = "按账户/卡/活动过滤，按创建时间倒序")
    @GetMapping("/api/v1/rewards")
    public EvaluationResponse.RewardPage rewards(@RequestParam(required = false) String accountId,
                                                 @RequestParam(required = false) String cardNumber,
                                                 @RequestParam(required = false) String campaignId,
                                                 @RequestParam(defaultValue = "0") int page,
                                                 @RequestParam(defaultValue = "10") int size) {
        PageResult<RewardView> result = queryService.rewards(accountId, cardNumber, campaignId, page, size);
        return EvaluationResponse.RewardPage.from(result.items(), result.page(), result.size(),
                result.total());
    }

    @Operation(summary = "重试返现入账", description = "PENDING/FAILED 的现金奖励重新调用账户返现（幂等）")
    @PostMapping("/api/v1/rewards/{rewardId}/fulfill")
    public EvaluationResponse.RewardResponse fulfill(@PathVariable String rewardId) {
        return EvaluationResponse.RewardResponse.from(evaluationService.fulfill(rewardId));
    }
}
