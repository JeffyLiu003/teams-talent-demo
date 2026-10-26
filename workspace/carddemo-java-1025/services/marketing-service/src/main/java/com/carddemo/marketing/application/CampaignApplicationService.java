package com.carddemo.marketing.application;

import com.carddemo.marketing.domain.model.Campaign;
import com.carddemo.marketing.domain.model.CampaignDraft;
import com.carddemo.marketing.domain.model.CampaignStatus;
import com.carddemo.marketing.domain.model.RewardGrant;
import com.carddemo.marketing.domain.model.RewardStatus;
import com.carddemo.marketing.domain.model.RewardType;
import com.carddemo.marketing.domain.repository.CampaignRepository;
import com.carddemo.marketing.domain.repository.EnrollmentRepository;
import com.carddemo.marketing.domain.repository.PageResult;
import com.carddemo.marketing.domain.repository.RewardGrantRepository;
import com.carddemo.marketing.domain.exception.InvalidRequestException;
import com.carddemo.marketing.domain.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 活动用例：创建/编辑/状态迁移/效果查询（MK-CAM-*）。
 */
@Service
@Transactional
public class CampaignApplicationService {

    static final int MAX_PAGE_SIZE = 100;

    private final CampaignRepository campaigns;
    private final EnrollmentRepository enrollments;
    private final RewardGrantRepository rewards;
    private final Clock clock;

    public CampaignApplicationService(CampaignRepository campaigns,
                                      EnrollmentRepository enrollments,
                                      RewardGrantRepository rewards,
                                      Clock clock) {
        this.campaigns = campaigns;
        this.enrollments = enrollments;
        this.rewards = rewards;
        this.clock = clock;
    }

    public Campaign create(CampaignDraft draft) {
        Campaign campaign = new Campaign(UUID.randomUUID().toString(), draft, LocalDateTime.now(clock));
        return campaigns.saveCampaign(campaign);
    }

    public Campaign update(String campaignId, CampaignDraft draft) {
        Campaign campaign = get(campaignId);
        campaign.applyDraft(draft, LocalDateTime.now(clock));
        return campaigns.saveCampaign(campaign);
    }

    @Transactional(readOnly = true)
    public Campaign get(String campaignId) {
        return campaigns.findCampaign(campaignId)
                .orElseThrow(() -> new NotFoundException("CAMPAIGN_NOT_FOUND",
                        "Campaign " + campaignId + " not found"));
    }

    @Transactional(readOnly = true)
    public PageResult<Campaign> list(String status, int page, int size) {
        validatePage(page, size);
        CampaignStatus parsed = null;
        if (status != null && !status.isBlank()) {
            try {
                parsed = CampaignStatus.valueOf(status.toUpperCase());
            } catch (IllegalArgumentException ex) {
                throw new InvalidRequestException("VALIDATION_FAILED", "Unknown campaign status: " + status);
            }
        }
        return campaigns.findCampaigns(parsed, page, size);
    }

    public Campaign activate(String campaignId) {
        Campaign campaign = get(campaignId);
        campaign.activate(LocalDateTime.now(clock));
        return campaigns.saveCampaign(campaign);
    }

    public Campaign pause(String campaignId) {
        Campaign campaign = get(campaignId);
        campaign.pause(LocalDateTime.now(clock));
        return campaigns.saveCampaign(campaign);
    }

    public Campaign end(String campaignId) {
        Campaign campaign = get(campaignId);
        campaign.end(LocalDateTime.now(clock));
        return campaigns.saveCampaign(campaign);
    }

    @Transactional(readOnly = true)
    public Performance performance(String campaignId) {
        Campaign campaign = get(campaignId);
        long enrolledCount = enrollments.countByCampaign(campaignId);
        List<RewardGrant> grants = rewards.findByCampaign(campaignId);
        long grantedCount = grants.stream().filter(RewardGrant::isGranted).count();
        long pendingCount = grants.stream().filter(g -> g.getStatus() == RewardStatus.PENDING).count();
        long failedCount = grants.stream().filter(g -> g.getStatus() == RewardStatus.FAILED).count();
        BigDecimal cashback = grants.stream()
                .filter(RewardGrant::isGranted)
                .filter(g -> g.getRewardType() == RewardType.CASHBACK)
                .map(RewardGrant::getRewardAmount)
                .reduce(BigDecimal.ZERO.setScale(2), BigDecimal::add);
        int points = grants.stream()
                .filter(RewardGrant::isGranted)
                .filter(g -> g.getRewardType() == RewardType.POINTS)
                .mapToInt(RewardGrant::getRewardPoints)
                .sum();
        BigDecimal utilization = campaign.getBudget().signum() > 0
                ? campaign.getConsumedAmount().divide(campaign.getBudget(), 4, RoundingMode.HALF_UP)
                : BigDecimal.ZERO.setScale(4);
        BigDecimal conversion = enrolledCount > 0
                ? BigDecimal.valueOf(grantedCount).divide(BigDecimal.valueOf(enrolledCount), 4, RoundingMode.HALF_UP)
                : BigDecimal.ZERO.setScale(4);
        return new Performance(campaign, enrolledCount, grants.size(), grantedCount, pendingCount,
                failedCount, cashback, points, campaign.getBudget(), campaign.getConsumedAmount(),
                utilization, conversion);
    }

    @Transactional(readOnly = true)
    public Summary summary() {
        long active = campaigns.countByStatus(CampaignStatus.ACTIVE);
        long pending = rewards.countByStatus(RewardStatus.PENDING.name());
        List<RewardGrant> granted = rewards.findGranted();
        BigDecimal cashback = granted.stream()
                .filter(g -> g.getRewardType() == RewardType.CASHBACK)
                .map(RewardGrant::getRewardAmount)
                .reduce(BigDecimal.ZERO.setScale(2), BigDecimal::add);
        int points = granted.stream()
                .filter(g -> g.getRewardType() == RewardType.POINTS)
                .mapToInt(RewardGrant::getRewardPoints)
                .sum();
        return new Summary(active, granted.size(), cashback, points, pending);
    }

    static void validatePage(int page, int size) {
        if (page < 0) {
            throw new InvalidRequestException("VALIDATION_FAILED", "Page must not be negative.");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new InvalidRequestException("VALIDATION_FAILED",
                    "Size must be between 1 and " + MAX_PAGE_SIZE + ".");
        }
    }

    public record Performance(Campaign campaign, long enrolledCount, long rewardCount,
                              long grantedCount, long pendingCount, long failedCount,
                              BigDecimal cashbackTotal, int pointsTotal, BigDecimal budget,
                              BigDecimal consumedAmount, BigDecimal budgetUtilization,
                              BigDecimal conversionRate) {
    }

    public record Summary(long activeCampaigns, long grantedRewards, BigDecimal cashbackTotal,
                          int pointsTotal, long pendingRewards) {
    }
}
