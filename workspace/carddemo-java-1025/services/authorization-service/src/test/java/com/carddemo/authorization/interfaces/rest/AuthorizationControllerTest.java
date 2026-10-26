package com.carddemo.authorization.interfaces.rest;

import com.carddemo.authorization.domain.model.AccountSnapshot;
import com.carddemo.authorization.domain.model.AuthorizationCase;
import com.carddemo.authorization.domain.model.AuthorizationRequest;
import com.carddemo.authorization.domain.model.AuthorizationSummary;
import com.carddemo.authorization.domain.model.CardSnapshot;
import com.carddemo.authorization.domain.model.CustomerSnapshot;
import com.carddemo.authorization.domain.repository.AuthorizationRepository;
import com.carddemo.authorization.domain.repository.AuthorizationSummaryRepository;
import com.carddemo.authorization.infrastructure.client.AccountClient;
import com.carddemo.authorization.infrastructure.client.CardClient;
import com.carddemo.authorization.infrastructure.client.CustomerClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 端到端用例：H2 + Flyway + MockMvc；card-service / account-service / customer-service 用 @MockBean 替换。
 * 可用额度：账户额度 2020.00 − 当前余额 1940.00 = 80.00；出现汇总后改为 信用额度 − 信用余额。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AuthorizationControllerTest {

    private static final String CARD_NUMBER = "0500024453765740";
    private static final String ACCOUNT_ID = "00000000001";
    private static final String CUSTOMER_ID = "000000001";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AuthorizationRepository authorizations;

    @Autowired
    private AuthorizationSummaryRepository summaries;

    @MockBean
    private CardClient cardClient;

    @MockBean
    private AccountClient accountClient;

    @MockBean
    private CustomerClient customerClient;

    private final CardSnapshot card = new CardSnapshot(CARD_NUMBER, ACCOUNT_ID, CUSTOMER_ID, "Y",
            LocalDate.of(2028, 5, 20));

    private final AccountSnapshot account = new AccountSnapshot(ACCOUNT_ID, "Y",
            new BigDecimal("1940.00"), new BigDecimal("2020.00"), new BigDecimal("1020.00"));

    private JsonNode body(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private void stubCardAndParties(CardSnapshot snapshot) {
        when(cardClient.findCard(CARD_NUMBER)).thenReturn(Optional.of(snapshot));
        when(customerClient.findCustomer(CUSTOMER_ID)).thenReturn(Optional.of(new CustomerSnapshot(CUSTOMER_ID)));
        when(accountClient.findAccount(ACCOUNT_ID)).thenReturn(Optional.of(account));
    }

    private String authorizationRequest(String amount, String transactionId) {
        return """
                {
                  "cardNumber": "%s",
                  "transactionAmount": %s,
                  "authType": "01",
                  "cardExpiryDate": "2805",
                  "messageType": "0100",
                  "messageSource": "POS",
                  "processingCode": "000000",
                  "merchantCategoryCode": "5411",
                  "acquirerCountryCode": "USA",
                  "posEntryMode": 5,
                  "merchantId": "MERCHANT0000001",
                  "merchantName": "Corner Grocery",
                  "merchantCity": "Springfield",
                  "merchantState": "IL",
                  "merchantZip": "62704",
                  "transactionId": "%s",
                  "authTimestamp": "2026-10-25T10:15:00"
                }
                """.formatted(CARD_NUMBER, amount, transactionId);
    }

    private MvcResult authorize(String amount, String transactionId) throws Exception {
        return mockMvc.perform(post("/api/v1/authorizations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(authorizationRequest(amount, transactionId)))
                .andExpect(status().isCreated())
                .andReturn();
    }

    @Test
    void approvesAuthorizationAndCreatesPendingSummary() throws Exception {
        stubCardAndParties(card);

        MvcResult result = mockMvc.perform(post("/api/v1/authorizations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(authorizationRequest("50.00", "TXN000000000001")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.authorizationId").isNotEmpty())
                .andExpect(jsonPath("$.cardNumber").value(CARD_NUMBER))
                .andExpect(jsonPath("$.transactionId").value("TXN000000000001"))
                .andExpect(jsonPath("$.authTimestamp").value("2026-10-25T10:15:00"))
                .andExpect(jsonPath("$.responseCode").value("00"))
                .andExpect(jsonPath("$.reasonCode").value("0000"))
                .andExpect(jsonPath("$.accountId").value(ACCOUNT_ID))
                .andExpect(jsonPath("$.customerId").value(CUSTOMER_ID))
                .andExpect(jsonPath("$.fraudFlag").value("N"))
                .andReturn();

        assertThat(body(result).get("approvedAmount").decimalValue()).isEqualByComparingTo("50.00");

        mockMvc.perform(get("/api/v1/pending-authorizations/" + ACCOUNT_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountId").value(ACCOUNT_ID))
                .andExpect(jsonPath("$.approvedCount").value(1))
                .andExpect(jsonPath("$.declinedCount").value(0));
    }

    @Test
    void declinesWith4100WhenAmountExceedsAvailableCredit() throws Exception {
        stubCardAndParties(card);

        MvcResult result = mockMvc.perform(post("/api/v1/authorizations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(authorizationRequest("500.00", "TXN000000000002")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.responseCode").value("05"))
                .andExpect(jsonPath("$.reasonCode").value("4100"))
                .andReturn();

        assertThat(body(result).get("approvedAmount").decimalValue()).isEqualByComparingTo("0.00");

        MvcResult pending = mockMvc.perform(get("/api/v1/pending-authorizations/" + ACCOUNT_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.declinedCount").value(1))
                .andExpect(jsonPath("$.approvedCount").value(0))
                .andReturn();
        assertThat(body(pending).get("declinedAmount").decimalValue()).isEqualByComparingTo("500.00");
        assertThat(body(pending).get("creditBalance").decimalValue()).isEqualByComparingTo("0.00");
    }

    @Test
    void declinesWith3100AndDoesNotPersistWhenCardDoesNotExist() throws Exception {
        when(cardClient.findCard(CARD_NUMBER)).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/v1/authorizations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(authorizationRequest("120.00", "TXN000000000003")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.responseCode").value("05"))
                .andExpect(jsonPath("$.reasonCode").value("3100"));

        mockMvc.perform(get("/api/v1/authorizations").param("accountId", ACCOUNT_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0))
                .andExpect(jsonPath("$.items.length()").value(0));

        assertThat(authorizations.countAuthorizations()).isZero();

        mockMvc.perform(get("/api/v1/pending-authorizations/" + ACCOUNT_ID))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("AUTHORIZATION_SUMMARY_NOT_FOUND"));
    }

    @Test
    void declinesWith4200WhenCardIsNotActive() throws Exception {
        stubCardAndParties(new CardSnapshot(CARD_NUMBER, ACCOUNT_ID, CUSTOMER_ID, "N",
                LocalDate.of(2028, 5, 20)));

        mockMvc.perform(post("/api/v1/authorizations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(authorizationRequest("50.00", "TXN000000000004")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.responseCode").value("05"))
                .andExpect(jsonPath("$.reasonCode").value("4200"));
    }

    @Test
    void declinesWith5100AfterCardIsFlaggedForFraud() throws Exception {
        stubCardAndParties(card);

        MvcResult approved = authorize("50.00", "TXN000000000005");
        String authorizationId = body(approved).get("authorizationId").asText();
        assertThat(body(approved).get("responseCode").asText()).isEqualTo("00");

        mockMvc.perform(post("/api/v1/authorizations/" + authorizationId + "/fraud"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authorizationId").value(authorizationId))
                .andExpect(jsonPath("$.fraudFlag").value("Y"))
                .andExpect(jsonPath("$.cardNumber").value(CARD_NUMBER))
                .andExpect(jsonPath("$.cardBlocked").value(true));

        mockMvc.perform(post("/api/v1/authorizations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(authorizationRequest("20.00", "TXN000000000006")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.responseCode").value("05"))
                .andExpect(jsonPath("$.reasonCode").value("5100"));

        mockMvc.perform(get("/api/v1/authorizations/" + authorizationId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fraudFlag").value("Y"))
                .andExpect(jsonPath("$.accountId").value(ACCOUNT_ID))
                .andExpect(jsonPath("$.merchantName").value("Corner Grocery"));
    }

    @Test
    void purgesExpiredDetailsAndReleasesCreditBalance() throws Exception {
        stubCardAndParties(card);
        MvcResult approved = authorize("50.00", "TXN000000000007");
        assertThat(body(approved).get("responseCode").asText()).isEqualTo("00");

        // 模拟 10 天前的批准授权：明细直接落库，并同步占用汇总的信用余额
        AuthorizationCase expired = new AuthorizationCase(new AuthorizationRequest(CARD_NUMBER,
                LocalDateTime.now().minusDays(10), new BigDecimal("100.00"), "01", "2805", "0100", "POS",
                "000000", "5411", "USA", 5, "MERCHANT0000001", "Corner Grocery", "Springfield", "IL",
                "62704", "TXN000000000008", ACCOUNT_ID, CUSTOMER_ID));
        expired.decide("00", "0000", new BigDecimal("100.00"));
        authorizations.saveAuthorization(expired);

        AuthorizationSummary summary = summaries.findSummary(ACCOUNT_ID).orElseThrow();
        summary.applyApproved(new BigDecimal("100.00"));
        summaries.saveSummary(summary);
        assertThat(summary.getCreditBalance()).isEqualByComparingTo("150.00");

        MvcResult purged = mockMvc.perform(post("/api/v1/authorization-purges")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expiryDays\": 5}"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = body(purged);
        assertThat(body.get("detailsRead").asInt()).isGreaterThanOrEqualTo(1);
        assertThat(body.get("detailsDeleted").asInt()).isGreaterThanOrEqualTo(1);
        assertThat(body.get("creditBalanceReleased").decimalValue()).isEqualByComparingTo("100.00");

        AuthorizationSummary refreshed = summaries.findSummary(ACCOUNT_ID).orElseThrow();
        assertThat(refreshed.getCreditBalance()).isEqualByComparingTo("50.00");
        assertThat(refreshed.getApprovedCount()).isEqualTo(1);
        assertThat(refreshed.getApprovedAmount()).isEqualByComparingTo("50.00");
        assertThat(authorizations.findAuthorization(expired.getAuthorizationId())).isEmpty();
        assertThat(authorizations.countAuthorizations()).isEqualTo(1);
    }

    @Test
    void returns404ForUnknownAuthorization() throws Exception {
        mockMvc.perform(get("/api/v1/authorizations/does-not-exist"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("AUTHORIZATION_NOT_FOUND"));

        mockMvc.perform(post("/api/v1/authorizations/does-not-exist/fraud"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("AUTHORIZATION_NOT_FOUND"));
    }

    @Test
    void rejectsInvalidAuthorizationRequest() throws Exception {
        mockMvc.perform(post("/api/v1/authorizations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(authorizationRequest("-1.00", "TXN000000000009")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        mockMvc.perform(post("/api/v1/authorization-purges")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expiryDays\": 500}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }
}
