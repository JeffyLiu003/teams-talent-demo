package com.carddemo.marketing.application;

import com.carddemo.marketing.domain.exception.BusinessRuleException;
import com.carddemo.marketing.domain.model.Campaign;
import com.carddemo.marketing.domain.model.CampaignStatus;
import com.carddemo.marketing.domain.model.Enrollment;
import com.carddemo.marketing.domain.repository.CampaignRepository;
import com.carddemo.marketing.domain.repository.EnrollmentRepository;
import com.carddemo.marketing.domain.repository.PageResult;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

/**
 * 报名用例（MK-ENR-01..03）：同一活动同一卡号幂等；只有 ACTIVE 活动可报名。
 */
@Service
@Transactional
public class EnrollmentApplicationService {

    private final CampaignRepository campaigns;
    private final EnrollmentRepository enrollments;
    private final Clock clock;

    public EnrollmentApplicationService(CampaignRepository campaigns,
                                        EnrollmentRepository enrollments,
                                        Clock clock) {
        this.campaigns = campaigns;
        this.enrollments = enrollments;
        this.clock = clock;
    }

    public Enrollment enroll(String campaignId, String cardNumber, String accountId, String customerId) {
        Campaign campaign = campaigns.findCampaign(campaignId)
                .orElseThrow(() -> new com.carddemo.marketing.domain.exception.NotFoundException(
                        "CAMPAIGN_NOT_FOUND", "Campaign " + campaignId + " not found"));
        if (campaign.getStatus() != CampaignStatus.ACTIVE) {
            throw new BusinessRuleException("CAMPAIGN_NOT_ACTIVE", "Only ACTIVE campaigns accept enrollment.");
        }
        Optional<Enrollment> existing = enrollments.findEnrollment(campaignId, cardNumber);
        if (existing.isPresent()) {
            return existing.get();
        }
        Enrollment enrollment = new Enrollment(UUID.randomUUID().toString(), campaignId, cardNumber,
                accountId, customerId, LocalDateTime.now(clock));
        return enrollments.saveEnrollment(enrollment);
    }

    @Transactional(readOnly = true)
    public PageResult<Enrollment> list(String campaignId, int page, int size) {
        CampaignApplicationService.validatePage(page, size);
        if (campaigns.findCampaign(campaignId).isEmpty()) {
            throw new com.carddemo.marketing.domain.exception.NotFoundException(
                    "CAMPAIGN_NOT_FOUND", "Campaign " + campaignId + " not found");
        }
        return enrollments.findEnrollments(campaignId, page, size);
    }
}
