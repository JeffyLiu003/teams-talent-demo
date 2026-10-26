package com.carddemo.account.domain.repository;

import com.carddemo.account.domain.model.RewardCredit;

public interface RewardCreditRepository {

    boolean existsByRewardId(String rewardId);

    RewardCredit saveCredit(RewardCredit credit);
}
