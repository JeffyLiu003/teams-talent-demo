package com.carddemo.marketing.infrastructure.persistence;

import com.carddemo.marketing.domain.model.Campaign;
import com.carddemo.marketing.domain.model.CampaignStatus;
import com.carddemo.marketing.domain.repository.CampaignRepository;
import com.carddemo.marketing.domain.repository.PageResult;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface CampaignJpaRepository extends JpaRepository<Campaign, String>, CampaignRepository {

    @Override
    default Optional<Campaign> findCampaign(String campaignId) {
        return findById(campaignId);
    }

    @Override
    default Campaign saveCampaign(Campaign campaign) {
        return save(campaign);
    }

    @Override
    default PageResult<Campaign> findCampaigns(CampaignStatus status, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Campaign> result = status == null
                ? findAll(pageable)
                : findAllByStatus(status, pageable);
        return new PageResult<>(result.getContent(), page, size, result.getTotalElements());
    }

    @Override
    default List<Campaign> findActiveAt(LocalDateTime moment) {
        return findAllByStatusAndStartAtLessThanEqualAndEndAtAfter(
                CampaignStatus.ACTIVE, moment, moment);
    }

    Page<Campaign> findAllByStatus(CampaignStatus status, Pageable pageable);

    List<Campaign> findAllByStatusAndStartAtLessThanEqualAndEndAtAfter(
            CampaignStatus status, LocalDateTime startBound, LocalDateTime endBound);

    long countByStatus(CampaignStatus status);
}
