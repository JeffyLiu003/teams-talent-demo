package com.carddemo.marketing.domain.repository;

import com.carddemo.marketing.domain.model.RewardGrant;

import java.util.List;
import java.util.Optional;

public interface RewardGrantRepository {

    Optional<RewardGrant> findReward(String rewardId);

    RewardGrant saveReward(RewardGrant grant);

    boolean existsByCampaignAndTransaction(String campaignId, String transactionId);

    long countByCampaignAndCard(String campaignId, String cardNumber);

    PageResult<RewardGrant> findRewards(String accountId, String cardNumber, String campaignId,
                                        int page, int size);

    List<RewardGrant> findByCampaign(String campaignId);

    List<RewardGrant> findGranted();

    long countByStatus(String status);
}
