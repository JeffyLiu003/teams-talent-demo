package com.carddemo.marketing.application;

import com.carddemo.marketing.domain.exception.RemoteServiceException;
import com.carddemo.marketing.domain.model.AccountSnapshot;
import com.carddemo.marketing.domain.model.Campaign;
import com.carddemo.marketing.domain.model.CampaignDraft;
import com.carddemo.marketing.domain.model.CampaignType;
import com.carddemo.marketing.domain.model.Enrollment;
import com.carddemo.marketing.domain.model.RewardGrant;
import com.carddemo.marketing.domain.model.RewardStatus;
import com.carddemo.marketing.domain.repository.CampaignRepository;
import com.carddemo.marketing.domain.repository.EnrollmentRepository;
import com.carddemo.marketing.domain.repository.RewardGrantRepository;
import com.carddemo.marketing.infrastructure.client.AccountClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RewardEvaluationServiceTest {

    private static final String CARD = "0500024453765740";
    private static final String ACCOUNT = "00000000001";
    private static final String CUSTOMER = "000000001";
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 25, 10, 0);
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-25T10:00:00Z"), ZoneOffset.UTC);

    @Mock
    private CampaignRepository campaigns;
    @Mock
    private EnrollmentRepository enrollments;
    @Mock
    private RewardGrantRepository rewards;
    @Mock
    private AccountClient accountClient;

    private RewardEvaluationService service;
    private Campaign campaign;

    @BeforeEach
    void setUp() {
        service = new RewardEvaluationService(campaigns, enrollments, rewards, accountClient, CLOCK);
        CampaignDraft draft = new CampaignDraft("餐饮返现", null, CampaignType.CATEGORY_CASHBACK,
                NOW.minusDays(10), NOW.plusDays(10), null, "0001",
                new BigDecimal("50.00"), new BigDecimal("0.0500"), null,
                new BigDecimal("30.00"), 5, new BigDecimal("1000.00"), null, true);
        campaign = new Campaign("c1", draft, NOW);
        campaign.activate(NOW);
    }

    private EvaluationCommand command() {
        return new EvaluationCommand("0000000000000901", CARD, ACCOUNT, CUSTOMER,
                new BigDecimal("120.00"), "0001", "01", "Dinner", NOW);
    }

    private void stubHappyPath() {
        when(accountClient.findAccount(ACCOUNT)).thenReturn(Optional.of(
                new AccountSnapshot(ACCOUNT, "Y", new BigDecimal("1940.00"), "A000000000")));
        when(campaigns.findActiveAt(any())).thenReturn(List.of(campaign));
        when(rewards.existsByCampaignAndTransaction("c1", "0000000000000901")).thenReturn(false);
        when(enrollments.findEnrollment("c1", CARD)).thenReturn(Optional.of(
                new Enrollment("e1", "c1", CARD, ACCOUNT, CUSTOMER, NOW)));
        when(rewards.countByCampaignAndCard("c1", CARD)).thenReturn(0L);
    }

    @Test
    void grantsCashbackAndCallsAccount() {
        stubHappyPath();

        EvaluationOutcome outcome = service.evaluate(command());

        assertThat(outcome.grants()).hasSize(1);
        RewardGrant grant = outcome.grants().get(0).grant();
        assertThat(grant.getStatus()).isEqualTo(RewardStatus.GRANTED);
        assertThat(grant.getRewardAmount()).isEqualByComparingTo("6.00");
        assertThat(campaign.getConsumedAmount()).isEqualByComparingTo("6.00");
        verify(accountClient).creditCashback(eq(ACCOUNT), eq(grant.getRewardId()), eq("c1"),
                eq(new BigDecimal("6.00")));
        verify(rewards).saveReward(grant);
    }

    @Test
    void keepsPendingWhenAccountUnavailable() {
        stubHappyPath();
        doThrow(new RemoteServiceException("account-service is unavailable"))
                .when(accountClient).creditCashback(anyString(), anyString(), anyString(), any());

        EvaluationOutcome outcome = service.evaluate(command());

        RewardGrant grant = outcome.grants().get(0).grant();
        assertThat(grant.getStatus()).isEqualTo(RewardStatus.PENDING);
        assertThat(grant.getFailureReason()).contains("account-service");
        verify(rewards).saveReward(grant);
    }

    @Test
    void isIdempotentPerCampaignAndTransaction() {
        when(accountClient.findAccount(ACCOUNT)).thenReturn(Optional.of(
                new AccountSnapshot(ACCOUNT, "Y", new BigDecimal("1940.00"), "A000000000")));
        when(campaigns.findActiveAt(any())).thenReturn(List.of(campaign));
        when(rewards.existsByCampaignAndTransaction("c1", "0000000000000901")).thenReturn(true);

        EvaluationOutcome outcome = service.evaluate(command());

        assertThat(outcome.grants()).isEmpty();
        assertThat(outcome.skipped()).extracting(EvaluationOutcome.Skipped::reason)
                .containsExactly("ALREADY_EVALUATED");
        verify(rewards, never()).saveReward(any());
    }

    @Test
    void skipsWhenNotEnrolled() {
        when(accountClient.findAccount(ACCOUNT)).thenReturn(Optional.of(
                new AccountSnapshot(ACCOUNT, "Y", new BigDecimal("1940.00"), "A000000000")));
        when(campaigns.findActiveAt(any())).thenReturn(List.of(campaign));
        when(rewards.existsByCampaignAndTransaction("c1", "0000000000000901")).thenReturn(false);
        when(enrollments.findEnrollment("c1", CARD)).thenReturn(Optional.empty());
        when(rewards.countByCampaignAndCard("c1", CARD)).thenReturn(0L);

        EvaluationOutcome outcome = service.evaluate(command());

        assertThat(outcome.grants()).isEmpty();
        assertThat(outcome.skipped()).extracting(EvaluationOutcome.Skipped::reason)
                .containsExactly("NOT_ENROLLED");
        verify(accountClient, never()).creditCashback(anyString(), anyString(), anyString(), any());
    }

    @Test
    void fulfilsPendingCashback() {
        RewardGrant pending = new RewardGrant("r1", "c1", "0000000000000901", CARD, ACCOUNT, CUSTOMER,
                com.carddemo.marketing.domain.model.RewardComputation.cashback(new BigDecimal("6.00")), NOW);
        pending.markPending("account-service is unavailable");
        when(rewards.findReward("r1")).thenReturn(Optional.of(pending));
        when(campaigns.findCampaign("c1")).thenReturn(Optional.of(campaign));

        RewardView view = service.fulfill("r1");

        assertThat(view.grant().getStatus()).isEqualTo(RewardStatus.GRANTED);
        assertThat(view.campaignName()).isEqualTo("餐饮返现");
        verify(rewards).saveReward(pending);
    }

    @Test
    void argumentCaptorKeepsGrantAmount() {
        stubHappyPath();
        service.evaluate(command());

        ArgumentCaptor<RewardGrant> captor = ArgumentCaptor.forClass(RewardGrant.class);
        verify(rewards).saveReward(captor.capture());
        assertThat(captor.getValue().getRewardPoints()).isZero();
        assertThat(captor.getValue().getAccountId()).isEqualTo(ACCOUNT);
    }
}
