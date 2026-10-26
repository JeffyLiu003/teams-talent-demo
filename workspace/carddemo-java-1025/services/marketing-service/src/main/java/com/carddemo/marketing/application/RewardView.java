package com.carddemo.marketing.application;

import com.carddemo.marketing.domain.model.RewardGrant;

public record RewardView(RewardGrant grant, String campaignName) {
}
