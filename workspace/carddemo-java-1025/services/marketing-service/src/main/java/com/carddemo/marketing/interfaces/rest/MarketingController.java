package com.carddemo.marketing.interfaces.rest;

import com.carddemo.marketing.application.CampaignApplicationService;
import com.carddemo.marketing.application.MarketingQueryService;
import com.carddemo.marketing.interfaces.rest.dto.OfferResponse;
import com.carddemo.marketing.interfaces.rest.dto.SummaryResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "营销查询", description = "活动中心（可参与活动）与看板汇总")
@RestController
public class MarketingController {

    private final MarketingQueryService queryService;
    private final CampaignApplicationService campaigns;

    public MarketingController(MarketingQueryService queryService,
                               CampaignApplicationService campaigns) {
        this.queryService = queryService;
        this.campaigns = campaigns;
    }

    @Operation(summary = "活动中心", description = "按账户/卡返回当前有效活动、是否已报名与资格原因")
    @GetMapping("/api/v1/eligibilities")
    public OfferResponse.ListResponse offers(@RequestParam String cardNumber,
                                             @RequestParam String accountId,
                                             @RequestParam(required = false) String customerId) {
        return new OfferResponse.ListResponse(queryService.offers(cardNumber, accountId, customerId)
                .stream().map(OfferResponse::from).toList());
    }

    @Operation(summary = "营销看板", description = "有效活动数、已发奖励、返现总额、积分总额、待处理奖励")
    @GetMapping("/api/v1/marketing/summary")
    public SummaryResponse summary() {
        return SummaryResponse.from(campaigns.summary());
    }
}
