package com.carddemo.marketing.application;

import com.carddemo.marketing.domain.exception.NotFoundException;
import com.carddemo.marketing.domain.model.AccountSnapshot;
import com.carddemo.marketing.domain.model.Campaign;
import com.carddemo.marketing.domain.model.RewardGrant;
import com.carddemo.marketing.domain.repository.CampaignRepository;
import com.carddemo.marketing.domain.repository.EnrollmentRepository;
import com.carddemo.marketing.domain.repository.PageResult;
import com.carddemo.marketing.domain.repository.RewardGrantRepository;
import com.carddemo.marketing.domain.service.EligibilityPolicy;
import com.carddemo.marketing.infrastructure.client.AccountClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 营销查询：活动中心（可参与活动）、奖励记录、看板汇总。
 */
@Service
@Transactional(readOnly = true)
public class MarketingQueryService {

    private final CampaignRepository campaigns;
    private final EnrollmentRepository enrollments;
    private final RewardGrantRepository rewards;
    private final AccountClient accountClient;
    private final Clock clock;

    public MarketingQueryService(CampaignRepository campaigns,
                                 EnrollmentRepository enrollments,
                                 RewardGrantRepository rewards,
                                 AccountClient accountClient,
                                 Clock clock) {
        this.campaigns = campaigns;
        this.enrollments = enrollments;
        this.rewards = rewards;
        this.accountClient = accountClient;
        this.clock = clock;
    }

    public List<OfferView> offers(String cardNumber, String accountId, String customerId) {
        AccountSnapshot account = accountClient.findAccount(accountId)
                .orElseThrow(() -> new NotFoundException("ACCOUNT_NOT_FOUND",
                        "Account " + accountId + " not found"));
        LocalDateTime now = LocalDateTime.now(clock);
        List<OfferView> views = new ArrayList<>();
        for (Campaign campaign : campaigns.findActiveAt(now)) {
            boolean enrolled = enrollments.findEnrollment(campaign.getCampaignId(), cardNumber).isPresent();
            EligibilityPolicy.Evaluation evaluation =
                    EligibilityPolicy.evaluateParticipation(campaign, account, enrolled, now);
            views.add(new OfferView(campaign, enrolled, evaluation.eligible(), evaluation.reason()));
        }
        return views;
    }

    public PageResult<RewardView> rewards(String accountId, String cardNumber, String campaignId,
                                          int page, int size) {
        CampaignApplicationService.validatePage(page, size);
        PageResult<RewardGrant> result = rewards.findRewards(accountId, cardNumber, campaignId, page, size);
        List<RewardView> views = result.items().stream()
                .map(grant -> new RewardView(grant, campaignName(grant.getCampaignId())))
                .toList();
        return new PageResult<>(views, result.page(), result.size(), result.total());
    }

    public RewardView reward(String rewardId) {
        RewardGrant grant = rewards.findReward(rewardId)
                .orElseThrow(() -> new NotFoundException("REWARD_NOT_FOUND", "Reward " + rewardId + " not found"));
        return new RewardView(grant, campaignName(grant.getCampaignId()));
    }

    private String campaignName(String campaignId) {
        return campaigns.findCampaign(campaignId).map(Campaign::getName).orElse(campaignId);
    }

    public record OfferView(Campaign campaign, boolean enrolled, boolean eligible, String reason) {
    }
}
