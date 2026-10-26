package com.carddemo.marketing.domain.repository;

import com.carddemo.marketing.domain.model.Campaign;
import com.carddemo.marketing.domain.model.CampaignStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface CampaignRepository {

    Optional<Campaign> findCampaign(String campaignId);

    Campaign saveCampaign(Campaign campaign);

    PageResult<Campaign> findCampaigns(CampaignStatus status, int page, int size);

    List<Campaign> findActiveAt(LocalDateTime moment);

    long countByStatus(CampaignStatus status);
}
