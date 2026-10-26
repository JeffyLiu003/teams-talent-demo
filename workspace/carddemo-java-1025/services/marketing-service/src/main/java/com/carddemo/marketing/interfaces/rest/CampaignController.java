package com.carddemo.marketing.interfaces.rest;

import com.carddemo.marketing.application.CampaignApplicationService;
import com.carddemo.marketing.application.EnrollmentApplicationService;
import com.carddemo.marketing.domain.model.Enrollment;
import com.carddemo.marketing.domain.repository.PageResult;
import com.carddemo.marketing.interfaces.rest.dto.CampaignPageResponse;
import com.carddemo.marketing.interfaces.rest.dto.CampaignRequest;
import com.carddemo.marketing.interfaces.rest.dto.CampaignResponse;
import com.carddemo.marketing.interfaces.rest.dto.EnrollmentRequest;
import com.carddemo.marketing.interfaces.rest.dto.PerformanceResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "营销活动", description = "活动创建、状态迁移、效果与报名")
@RestController
@RequestMapping("/api/v1/campaigns")
public class CampaignController {

    private final CampaignApplicationService campaigns;
    private final EnrollmentApplicationService enrollments;

    public CampaignController(CampaignApplicationService campaigns,
                              EnrollmentApplicationService enrollments) {
        this.campaigns = campaigns;
        this.enrollments = enrollments;
    }

    @Operation(summary = "活动列表", description = "status 可选：DRAFT/ACTIVE/PAUSED/ENDED")
    @GetMapping
    public CampaignPageResponse list(@RequestParam(required = false) String status,
                                     @RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "10") int size) {
        return CampaignPageResponse.from(campaigns.list(status, page, size));
    }

    @GetMapping("/{campaignId}")
    public CampaignResponse get(@PathVariable String campaignId) {
        return CampaignResponse.from(campaigns.get(campaignId));
    }

    @Operation(summary = "新建活动", description = "创建后为 DRAFT，需要 activate 才会生效")
    @PostMapping
    public ResponseEntity<CampaignResponse> create(@Valid @RequestBody CampaignRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(CampaignResponse.from(campaigns.create(request.toDraft())));
    }

    @Operation(summary = "编辑活动", description = "仅 DRAFT 可编辑")
    @PutMapping("/{campaignId}")
    public CampaignResponse update(@PathVariable String campaignId,
                                   @Valid @RequestBody CampaignRequest request) {
        return CampaignResponse.from(campaigns.update(campaignId, request.toDraft()));
    }

    @PostMapping("/{campaignId}/activate")
    public CampaignResponse activate(@PathVariable String campaignId) {
        return CampaignResponse.from(campaigns.activate(campaignId));
    }

    @PostMapping("/{campaignId}/pause")
    public CampaignResponse pause(@PathVariable String campaignId) {
        return CampaignResponse.from(campaigns.pause(campaignId));
    }

    @PostMapping("/{campaignId}/end")
    public CampaignResponse end(@PathVariable String campaignId) {
        return CampaignResponse.from(campaigns.end(campaignId));
    }

    @Operation(summary = "活动效果", description = "报名数、发奖数、返现成本、预算使用率、转化率")
    @GetMapping("/{campaignId}/performance")
    public PerformanceResponse performance(@PathVariable String campaignId) {
        return PerformanceResponse.from(campaigns.performance(campaignId));
    }

    @Operation(summary = "报名活动", description = "同一活动同一卡号幂等；仅 ACTIVE 活动可报名")
    @PostMapping("/{campaignId}/enrollments")
    public ResponseEntity<EnrollmentRequest.Response> enroll(
            @PathVariable String campaignId,
            @Valid @RequestBody EnrollmentRequest request) {
        Enrollment enrollment = enrollments.enroll(campaignId, request.cardNumber(),
                request.accountId(), blankToNull(request.customerId()));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(EnrollmentRequest.Response.from(enrollment));
    }

    @GetMapping("/{campaignId}/enrollments")
    public EnrollmentRequest.Page listEnrollments(@PathVariable String campaignId,
                                                  @RequestParam(defaultValue = "0") int page,
                                                  @RequestParam(defaultValue = "10") int size) {
        PageResult<Enrollment> result = enrollments.list(campaignId, page, size);
        return new EnrollmentRequest.Page(result.items().stream()
                .map(EnrollmentRequest.Response::from).toList(),
                result.page(), result.size(), result.total());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
