package com.carddemo.account.infrastructure.persistence;

import com.carddemo.account.domain.model.RewardCredit;
import com.carddemo.account.domain.repository.RewardCreditRepository;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RewardCreditJpaRepository extends JpaRepository<RewardCredit, String>, RewardCreditRepository {

    @Override
    default boolean existsByRewardId(String rewardId) {
        return existsById(rewardId);
    }

    @Override
    default RewardCredit saveCredit(RewardCredit credit) {
        return save(credit);
    }
}
