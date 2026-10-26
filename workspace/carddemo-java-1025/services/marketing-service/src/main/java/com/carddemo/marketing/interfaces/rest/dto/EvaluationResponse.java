package com.carddemo.marketing.interfaces.rest.dto;

import com.carddemo.marketing.application.EvaluationOutcome;
import com.carddemo.marketing.application.RewardView;
import com.carddemo.marketing.domain.model.RewardGrant;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record EvaluationResponse(List<RewardResponse> grants, List<Skipped> skipped) {

    public record Skipped(String campaignId, String campaignName, String reason) {
    }

    public static EvaluationResponse from(EvaluationOutcome outcome) {
        return new EvaluationResponse(outcome.grants().stream().map(RewardResponse::from).toList(),
                outcome.skipped().stream()
                        .map(s -> new Skipped(s.campaignId(), s.campaignName(), s.reason()))
                        .toList());
    }

    public record RewardResponse(String rewardId, String campaignId, String campaignName,
                                 String transactionId, String cardNumber, String accountId,
                                 String customerId, String rewardType, BigDecimal rewardAmount,
                                 int rewardPoints, String status, String failureReason,
                                 LocalDateTime createdAt, LocalDateTime grantedAt) {

        public static RewardResponse from(RewardView view) {
            RewardGrant grant = view.grant();
            return new RewardResponse(grant.getRewardId(), grant.getCampaignId(), view.campaignName(),
                    grant.getTransactionId(), grant.getCardNumber(), grant.getAccountId(),
                    grant.getCustomerId(), grant.getRewardType().name(), grant.getRewardAmount(),
                    grant.getRewardPoints(), grant.getStatus().name(), grant.getFailureReason(),
                    grant.getCreatedAt(), grant.getGrantedAt());
        }
    }

    public record RewardPage(List<RewardResponse> items, int page, int size, long total) {

        public static RewardPage from(List<RewardView> items, int page, int size, long total) {
            return new RewardPage(items.stream().map(RewardResponse::from).toList(), page, size, total);
        }
    }
}
