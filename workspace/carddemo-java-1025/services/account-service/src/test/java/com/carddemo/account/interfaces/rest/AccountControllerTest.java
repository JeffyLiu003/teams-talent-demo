package com.carddemo.account.interfaces.rest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AccountControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private BigDecimal balanceOf(String accountId) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/accounts/{id}", accountId))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.get("currentBalance").decimalValue();
    }

    @Test
    void returnsSeededAccount() throws Exception {
        mockMvc.perform(get("/api/v1/accounts/00000000001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountId").value("00000000001"))
                .andExpect(jsonPath("$.activeStatus").value("Y"));
    }

    @Test
    void returns404ForUnknownAccount() throws Exception {
        mockMvc.perform(get("/api/v1/accounts/99999999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACCOUNT_NOT_FOUND"));
    }

    @Test
    void postingPositiveAmountUpdatesBalanceAndCycleCredit() throws Exception {
        BigDecimal before = balanceOf("00000000003");

        mockMvc.perform(post("/api/v1/accounts/00000000003/postings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\": 10.00}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentCycleCredit").value(10.00));

        assertThat(balanceOf("00000000003")).isEqualByComparingTo(before.add(new BigDecimal("10.00")));
    }

    @Test
    void billPaymentRejectsAccountWithZeroBalance() throws Exception {
        mockMvc.perform(post("/api/v1/accounts/00000000005/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\": 10.00}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NOTHING_TO_PAY"));
    }

    @Test
    void cashbackCreditIsIdempotentPerRewardId() throws Exception {
        BigDecimal before = balanceOf("00000000008");
        String body = """
                {"rewardId":"r-test-0001","campaignId":"c-test-0001","amount":6.00}
                """;

        mockMvc.perform(post("/api/v1/accounts/00000000008/cashback-credits")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());

        BigDecimal afterFirst = balanceOf("00000000008");
        assertThat(afterFirst).isEqualByComparingTo(before.subtract(new BigDecimal("6.00")));

        mockMvc.perform(post("/api/v1/accounts/00000000008/cashback-credits")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());

        assertThat(balanceOf("00000000008")).isEqualByComparingTo(afterFirst);
    }

    @Test
    void updateRejectsInvalidStatus() throws Exception {
        String body = """
                {
                  "activeStatus": "X",
                  "currentBalance": 100.00,
                  "creditLimit": 2000.00,
                  "cashCreditLimit": 1000.00,
                  "openDate": "2020-01-01",
                  "expirationDate": "2028-01-01",
                  "reissueDate": "2028-01-01",
                  "currentCycleCredit": 0.00,
                  "currentCycleDebit": 0.00
                }
                """;

        mockMvc.perform(put("/api/v1/accounts/00000000004")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }
}
