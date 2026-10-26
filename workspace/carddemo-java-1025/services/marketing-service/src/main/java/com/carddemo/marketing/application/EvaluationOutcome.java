package com.carddemo.marketing.application;

import java.util.List;

public record EvaluationOutcome(List<RewardView> grants, List<Skipped> skipped) {

    public record Skipped(String campaignId, String campaignName, String reason) {
    }
}
