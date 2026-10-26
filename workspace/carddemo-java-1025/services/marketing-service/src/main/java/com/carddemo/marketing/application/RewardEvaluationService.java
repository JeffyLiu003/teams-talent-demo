package com.carddemo.marketing.application;

import com.carddemo.marketing.domain.exception.BusinessRuleException;
import com.carddemo.marketing.domain.exception.InvalidRequestException;
import com.carddemo.marketing.domain.exception.NotFoundException;
import com.carddemo.marketing.domain.exception.RemoteServiceException;
import com.carddemo.marketing.domain.model.AccountSnapshot;
import com.carddemo.marketing.domain.model.Campaign;
import com.carddemo.marketing.domain.model.RewardComputation;
import com.carddemo.marketing.domain.model.RewardGrant;
import com.carddemo.marketing.domain.repository.CampaignRepository;
import com.carddemo.marketing.domain.repository.EnrollmentRepository;
import com.carddemo.marketing.domain.repository.RewardGrantRepository;
import com.carddemo.marketing.domain.service.EligibilityPolicy;
import com.carddemo.marketing.infrastructure.client.AccountClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 奖励评估与发放（MK-REW-01..08）。
 * 幂等：同一活动同一交易只发一次；返现入账由 account-service 以 rewardId 再保证一次幂等。
 */
@Service
@Transactional(noRollbackFor = RemoteServiceException.class)
public class RewardEvaluationService {

    private final CampaignRepository campaigns;
    private final EnrollmentRepository enrollments;
    private final RewardGrantRepository rewards;
    private final AccountClient accountClient;
    private final Clock clock;

    public RewardEvaluationService(CampaignRepository campaigns,
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

    public EvaluationOutcome evaluate(EvaluationCommand command) {
        validate(command);
        List<RewardView> grants = new ArrayList<>();
        List<EvaluationOutcome.Skipped> skipped = new ArrayList<>();

        AccountSnapshot account = accountClient.findAccount(command.accountId()).orElse(null);
        if (account == null) {
            skipped.add(new EvaluationOutcome.Skipped(null, null, EligibilityPolicy.ACCOUNT_NOT_FOUND));
            return new EvaluationOutcome(grants, skipped);
        }

        LocalDateTime now = LocalDateTime.now(clock);
        for (Campaign campaign : campaigns.findActiveAt(now)) {
            if (rewards.existsByCampaignAndTransaction(campaign.getCampaignId(), command.transactionId())) {
                skipped.add(new EvaluationOutcome.Skipped(campaign.getCampaignId(), campaign.getName(),
                        "ALREADY_EVALUATED"));
                continue;
            }
            boolean enrolled = enrollments
                    .findEnrollment(campaign.getCampaignId(), command.cardNumber())
                    .isPresent();
            long rewardsOnCard = rewards.countByCampaignAndCard(campaign.getCampaignId(), command.cardNumber());
            EligibilityPolicy.Evaluation evaluation = EligibilityPolicy.evaluateTransaction(
                    campaign, account, command.amount(), command.categoryCode(), enrolled,
                    rewardsOnCard, now);
            if (!evaluation.eligible()) {
                skipped.add(new EvaluationOutcome.Skipped(campaign.getCampaignId(), campaign.getName(),
                        evaluation.reason()));
                continue;
            }

            RewardComputation computation = evaluation.reward();
            try {
                campaign.consumeCashback(computation.amount());
            } catch (BusinessRuleException ex) {
                skipped.add(new EvaluationOutcome.Skipped(campaign.getCampaignId(), campaign.getName(),
                        EligibilityPolicy.BUDGET_EXHAUSTED));
                continue;
            }

            RewardGrant grant = new RewardGrant(UUID.randomUUID().toString(),
                    campaign.getCampaignId(), command.transactionId(), command.cardNumber(),
                    command.accountId(), command.customerId(), computation, now);
            if (grant.isCashback()) {
                try {
                    accountClient.creditCashback(command.accountId(), grant.getRewardId(),
                            campaign.getCampaignId(), grant.getRewardAmount());
                    grant.markGranted(now);
                } catch (RemoteServiceException ex) {
                    grant.markPending("Cashback credit pending: " + ex.getMessage());
                }
            } else {
                grant.markGranted(now);
            }
            rewards.saveReward(grant);
            campaigns.saveCampaign(campaign);
            grants.add(new RewardView(grant, campaign.getName()));
        }
        return new EvaluationOutcome(grants, skipped);
    }

    public RewardView fulfill(String rewardId) {
        RewardGrant grant = rewards.findReward(rewardId)
                .orElseThrow(() -> new NotFoundException("REWARD_NOT_FOUND",
                        "Reward " + rewardId + " not found"));
        Campaign campaign = campaigns.findCampaign(grant.getCampaignId()).orElse(null);

        if (!grant.isGranted()) {
            if (!grant.isCashback()) {
                grant.markGranted(LocalDateTime.now(clock));
            } else {
                try {
                    accountClient.creditCashback(grant.getAccountId(), grant.getRewardId(),
                            grant.getCampaignId(), grant.getRewardAmount());
                    grant.markGranted(LocalDateTime.now(clock));
                } catch (RemoteServiceException ex) {
                    grant.markPending(ex.getMessage());
                    rewards.saveReward(grant);
                    throw ex;
                }
            }
            rewards.saveReward(grant);
        }
        return new RewardView(grant, campaign == null ? grant.getCampaignId() : campaign.getName());
    }

    private static void validate(EvaluationCommand command) {
        if (command.transactionId() == null || command.transactionId().isBlank()) {
            throw new InvalidRequestException("VALIDATION_FAILED", "Transaction ID must be supplied.");
        }
        if (command.cardNumber() == null || !command.cardNumber().matches("\\d{16}")) {
            throw new InvalidRequestException("VALIDATION_FAILED", "Card Number must be 16 digits.");
        }
        if (command.accountId() == null || !command.accountId().matches("\\d{11}")) {
            throw new InvalidRequestException("VALIDATION_FAILED", "Account ID must be 11 digits.");
        }
        if (command.amount() == null || command.amount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new InvalidRequestException("VALIDATION_FAILED", "Transaction amount must be greater than zero.");
        }
    }
}
