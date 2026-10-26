package com.carddemo.marketing.infrastructure.persistence;

import com.carddemo.marketing.domain.model.RewardGrant;
import com.carddemo.marketing.domain.model.RewardStatus;
import com.carddemo.marketing.domain.repository.PageResult;
import com.carddemo.marketing.domain.repository.RewardGrantRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public interface RewardGrantJpaRepository
        extends JpaRepository<RewardGrant, String>, JpaSpecificationExecutor<RewardGrant>,
        RewardGrantRepository {

    @Override
    default Optional<RewardGrant> findReward(String rewardId) {
        return findById(rewardId);
    }

    @Override
    default RewardGrant saveReward(RewardGrant grant) {
        return save(grant);
    }

    @Override
    default boolean existsByCampaignAndTransaction(String campaignId, String transactionId) {
        return existsByCampaignIdAndTransactionId(campaignId, transactionId);
    }

    @Override
    default long countByCampaignAndCard(String campaignId, String cardNumber) {
        return countByCampaignIdAndCardNumber(campaignId, cardNumber);
    }

    @Override
    default PageResult<RewardGrant> findRewards(String accountId, String cardNumber, String campaignId,
                                                int page, int size) {
        Specification<RewardGrant> specification = (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (accountId != null && !accountId.isBlank()) {
                predicates.add(builder.equal(root.get("accountId"), accountId));
            }
            if (cardNumber != null && !cardNumber.isBlank()) {
                predicates.add(builder.equal(root.get("cardNumber"), cardNumber));
            }
            if (campaignId != null && !campaignId.isBlank()) {
                predicates.add(builder.equal(root.get("campaignId"), campaignId));
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };
        Page<RewardGrant> result = findAll(specification,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return new PageResult<>(result.getContent(), page, size, result.getTotalElements());
    }

    @Override
    default List<RewardGrant> findByCampaign(String campaignId) {
        return findAllByCampaignId(campaignId);
    }

    @Override
    default List<RewardGrant> findGranted() {
        return findAllByStatus(RewardStatus.GRANTED);
    }

    @Override
    default long countByStatus(String status) {
        return countByStatusIs(RewardStatus.valueOf(status));
    }

    boolean existsByCampaignIdAndTransactionId(String campaignId, String transactionId);

    long countByCampaignIdAndCardNumber(String campaignId, String cardNumber);

    List<RewardGrant> findAllByCampaignId(String campaignId);

    List<RewardGrant> findAllByStatus(RewardStatus status);

    long countByStatusIs(RewardStatus status);
}
