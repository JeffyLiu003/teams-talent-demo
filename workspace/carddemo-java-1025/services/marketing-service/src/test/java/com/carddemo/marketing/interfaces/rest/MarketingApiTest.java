package com.carddemo.marketing.interfaces.rest;

import com.carddemo.marketing.domain.model.AccountSnapshot;
import com.carddemo.marketing.infrastructure.client.AccountClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class MarketingApiTest {

    private static final String CARD = "0500024453765740";
    private static final String ACCOUNT = "00000000001";
    private static final String CUSTOMER = "000000001";
    private static final String CATEGORY_CAMPAIGN = "c0000000-0000-0000-0000-000000000002";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AccountClient accountClient;

    private JsonNode body(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private void stubAccount() {
        when(accountClient.findAccount(ACCOUNT)).thenReturn(Optional.of(
                new AccountSnapshot(ACCOUNT, "Y", new BigDecimal("1940.00"), "A000000000")));
        when(accountClient.findAccount("00000000006")).thenReturn(Optional.of(
                new AccountSnapshot("00000000006", "Y", new BigDecimal("2450.75"), "C000000000")));
        doNothing().when(accountClient).creditCashback(anyString(), anyString(), anyString(), any());
    }

    @Test
    @Order(1)
    void listsSeededCampaigns() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/campaigns?page=0&size=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(4))
                .andReturn();
        JsonNode body = body(result);
        long active = 0;
        long draft = 0;
        for (JsonNode item : body.get("items")) {
            if ("ACTIVE".equals(item.get("status").asText())) active++;
            if ("DRAFT".equals(item.get("status").asText())) draft++;
        }
        assertThat(active).isEqualTo(3);
        assertThat(draft).isEqualTo(1);
    }

    @Test
    @Order(2)
    void rejectsInvalidCampaign() throws Exception {
        String request = """
                {"name":"无效首刷礼","campaignType":"FIRST_PURCHASE_CASHBACK",
                 "startAt":"2026-11-01T00:00:00","endAt":"2026-11-30T00:00:00",
                 "minTransactionAmount":100.00,"budget":1000.00,"enrollmentRequired":false}
                """;
        mockMvc.perform(post("/api/v1/campaigns").contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_CAMPAIGN_RULE"));
    }

    @Test
    @Order(3)
    void createsActivatesAndEndsCampaign() throws Exception {
        String request = """
                {"name":"双十二餐饮返现","description":"演示发布流程","campaignType":"CATEGORY_CASHBACK",
                 "startAt":"2026-12-01T00:00:00","endAt":"2026-12-12T23:59:59",
                 "categoryCode":"0001","minTransactionAmount":50.00,"rewardRate":0.0800,
                 "maxRewardPerTransaction":40.00,"maxRewardsPerCard":3,"budget":5000.00,
                 "enrollmentRequired":true}
                """;
        MvcResult created = mockMvc.perform(post("/api/v1/campaigns")
                        .contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andReturn();
        String campaignId = body(created).get("campaignId").asText();

        mockMvc.perform(post("/api/v1/campaigns/" + campaignId + "/activate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));
        mockMvc.perform(post("/api/v1/campaigns/" + campaignId + "/end"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ENDED"));
        mockMvc.perform(get("/api/v1/campaigns/" + campaignId + "/performance"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.grantedCount").value(0));
    }

    @Test
    @Order(4)
    void showsOffersWithEnrollmentStatus() throws Exception {
        stubAccount();
        MvcResult result = mockMvc.perform(get("/api/v1/eligibilities")
                        .param("cardNumber", CARD)
                        .param("accountId", ACCOUNT)
                        .param("customerId", CUSTOMER))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode items = body(result).get("items");
        assertThat(items.size()).isEqualTo(3);
        JsonNode categoryOffer = null;
        for (JsonNode item : items) {
            if (CATEGORY_CAMPAIGN.equals(item.get("campaignId").asText())) {
                categoryOffer = item;
            }
        }
        assertThat(categoryOffer).isNotNull();
        assertThat(categoryOffer.get("enrolled").asBoolean()).isTrue();
        assertThat(categoryOffer.get("eligible").asBoolean()).isTrue();
    }

    @Test
    @Order(5)
    void enrollsIdempotently() throws Exception {
        String request = """
                {"cardNumber":"3344556677889900","accountId":"00000000006","customerId":"000000006"}
                """;
        MvcResult first = mockMvc.perform(post("/api/v1/campaigns/" + CATEGORY_CAMPAIGN + "/enrollments")
                        .contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isCreated())
                .andReturn();
        String enrollmentId = body(first).get("enrollmentId").asText();

        mockMvc.perform(post("/api/v1/campaigns/" + CATEGORY_CAMPAIGN + "/enrollments")
                        .contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.enrollmentId").value(enrollmentId));
    }

    @Test
    @Order(6)
    void evaluatesRewardsAndIsIdempotent() throws Exception {
        stubAccount();
        String request = """
                {"transactionId":"0000000000000901","cardNumber":"0500024453765740",
                 "accountId":"00000000001","customerId":"000000001","amount":120.00,
                 "categoryCode":"0001","typeCode":"01","description":"Dinner",
                 "processedAt":"2026-10-25T19:30:00"}
                """;
        MvcResult result = mockMvc.perform(post("/api/v1/reward-evaluations")
                        .contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode grants = body(result).get("grants");
        assertThat(grants.size()).isEqualTo(2);
        BigDecimal total = BigDecimal.ZERO;
        for (JsonNode grant : grants) {
            total = total.add(grant.get("rewardAmount").decimalValue());
        }
        assertThat(total).isEqualByComparingTo("26.00");

        mockMvc.perform(post("/api/v1/reward-evaluations")
                        .contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.grants.length()").value(0));
    }

    @Test
    @Order(7)
    void showsRewardsPerformanceAndSummary() throws Exception {
        mockMvc.perform(get("/api/v1/rewards").param("accountId", ACCOUNT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.items[0].campaignName").isNotEmpty());

        mockMvc.perform(get("/api/v1/campaigns/" + CATEGORY_CAMPAIGN + "/performance"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enrolledCount").value(2))
                .andExpect(jsonPath("$.grantedCount").value(1))
                .andExpect(jsonPath("$.consumedAmount").value(6.00))
                .andExpect(jsonPath("$.budgetUtilization").value(0.0006));

        mockMvc.perform(get("/api/v1/marketing/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeCampaigns").value(3))
                .andExpect(jsonPath("$.grantedRewards").value(2))
                .andExpect(jsonPath("$.cashbackTotal").value(26.00))
                .andExpect(jsonPath("$.pendingRewards").value(0));
    }

    @Test
    @Order(8)
    void returns404ForUnknownCampaign() throws Exception {
        mockMvc.perform(get("/api/v1/campaigns/not-exists"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CAMPAIGN_NOT_FOUND"));
    }
}
