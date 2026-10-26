package com.carddemo.card.interfaces.rest;

import com.carddemo.card.domain.model.Card;
import com.carddemo.card.domain.model.CardXref;
import com.carddemo.card.domain.repository.CardRepository;
import com.carddemo.card.infrastructure.persistence.CardXrefJpaRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CardControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private CardRepository cards;

    @Autowired
    private CardXrefJpaRepository xrefs;

    @Test
    void listByAccountReturnsBothCardsOfAccountOneOrderedByCardNumber() throws Exception {
        mockMvc.perform(get("/api/v1/cards/by-account/00000000001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].cardNumber").value("0500024453765740"))
                .andExpect(jsonPath("$.items[0].accountId").value("00000000001"))
                .andExpect(jsonPath("$.items[0].customerId").value("000000001"))
                .andExpect(jsonPath("$.items[0].embossedName").value("IMMANUEL KESSLER"))
                .andExpect(jsonPath("$.items[0].expiryDate").value("2028-05-20"))
                .andExpect(jsonPath("$.items[0].activeStatus").value("Y"))
                .andExpect(jsonPath("$.items[1].cardNumber").value("6677889900112233"));
    }

    @Test
    void getReturnsCardByCardNumberWithoutCvv() throws Exception {
        mockMvc.perform(get("/api/v1/cards/4455667788990011"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cardNumber").value("4455667788990011"))
                .andExpect(jsonPath("$.accountId").value("00000000007"))
                .andExpect(jsonPath("$.customerId").value("000000007"))
                .andExpect(jsonPath("$.embossedName").value("DANIEL WHITFIELD"))
                .andExpect(jsonPath("$.expiryDate").value("2024-05-05"))
                .andExpect(jsonPath("$.activeStatus").value("N"))
                .andExpect(jsonPath("$.cvv").doesNotExist());
    }

    @Test
    void getReturns404ForUnknownCard() throws Exception {
        mockMvc.perform(get("/api/v1/cards/9999999999999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CARD_NOT_FOUND"));
    }

    @Test
    void getRejectsCardNumberThatIsNotSixteenDigits() throws Exception {
        mockMvc.perform(get("/api/v1/cards/123"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void listFiltersByAccountAndCustomerAndPagesBySeven() throws Exception {
        mockMvc.perform(get("/api/v1/cards")
                        .param("accountId", "00000000001")
                        .param("customerId", "000000001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(7))
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].cvv").doesNotExist());

        mockMvc.perform(get("/api/v1/cards")
                        .param("accountId", "00000000001")
                        .param("customerId", "000000002"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0))
                .andExpect(jsonPath("$.items.length()").value(0));
    }

    @Test
    void listReturnsAtMostSevenCardsPerPage() throws Exception {
        mockMvc.perform(get("/api/v1/cards").param("page", "0").param("size", "7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(7))
                .andExpect(jsonPath("$.items.length()").value(7))
                .andExpect(jsonPath("$.items[0].cardNumber").value("0500024453765740"));
    }

    @Test
    void listTreatsEmptyCustomerIdAsNoFilter() throws Exception {
        mockMvc.perform(get("/api/v1/cards")
                        .param("accountId", "00000000001")
                        .param("customerId", "")
                        .param("page", "0")
                        .param("size", "7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.items.length()").value(2));
    }

    @Test
    void listRejectsAccountIdThatIsNotElevenDigits() throws Exception {
        mockMvc.perform(get("/api/v1/cards").param("accountId", "0000000001"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void updateChangesEmbossedNameStatusAndExpiryButNeverCvv() throws Exception {
        String body = """
                {
                  "embossedName": "ENRICO R ROSENBAUM",
                  "activeStatus": "N",
                  "expiryMonth": 8,
                  "expiryYear": 2030
                }
                """;

        mockMvc.perform(put("/api/v1/cards/0683586198171516")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cardNumber").value("0683586198171516"))
                .andExpect(jsonPath("$.embossedName").value("ENRICO R ROSENBAUM"))
                .andExpect(jsonPath("$.activeStatus").value("N"))
                .andExpect(jsonPath("$.expiryDate").value("2030-08-11"))
                .andExpect(jsonPath("$.cvv").doesNotExist());

        Card updated = cards.findByCardNumber("0683586198171516").orElseThrow();
        assertThat(updated.getCvv()).isEqualTo("275");
    }

    @Test
    void updateRejectsInvalidStatus() throws Exception {
        String body = """
                {"embossedName": "CLAIRE DUBUQUE", "activeStatus": "X", "expiryMonth": 2, "expiryYear": 2028}
                """;

        mockMvc.perform(put("/api/v1/cards/1122334455667788")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void updateRejectsExpiryMonthOutsideOneToTwelve() throws Exception {
        String body = """
                {"embossedName": "CLAIRE DUBUQUE", "activeStatus": "Y", "expiryMonth": 13, "expiryYear": 2028}
                """;

        mockMvc.perform(put("/api/v1/cards/1122334455667788")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void updateReturns404ForUnknownCard() throws Exception {
        String body = """
                {"embossedName": "NOBODY HERE", "activeStatus": "Y", "expiryMonth": 1, "expiryYear": 2030}
                """;

        mockMvc.perform(put("/api/v1/cards/9999999999999999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CARD_NOT_FOUND"));
    }

    @Test
    void createReturns409WhenCardNumberAlreadyExists() throws Exception {
        String body = """
                {
                  "cardNumber": "0500024453765740",
                  "accountId": "00000000001",
                  "customerId": "000000001",
                  "cvv": "123",
                  "embossedName": "IMMANUEL KESSLER",
                  "expiryDate": "2028-05-20",
                  "activeStatus": "Y"
                }
                """;

        mockMvc.perform(post("/api/v1/cards")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CARD_ALREADY_EXISTS"));
    }

    @Test
    void createReturns409WhenAccountBelongsToAnotherCustomer() throws Exception {
        String body = """
                {
                  "cardNumber": "7777888899990000",
                  "accountId": "00000000001",
                  "customerId": "000000002",
                  "cvv": "321",
                  "embossedName": "ENRICO ROSENBAUM",
                  "expiryDate": "2029-08-11",
                  "activeStatus": "Y"
                }
                """;

        mockMvc.perform(post("/api/v1/cards")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACCOUNT_CUSTOMER_MISMATCH"));
    }

    @Test
    void createRegistersCardAndCrossReferenceWithoutCvvInResponse() throws Exception {
        String body = """
                {
                  "cardNumber": "8888999900001111",
                  "accountId": "00000000005",
                  "customerId": "000000005",
                  "cvv": "654",
                  "embossedName": "MARCUS CHEN",
                  "expiryDate": "2031-07-01",
                  "activeStatus": "Y"
                }
                """;

        mockMvc.perform(post("/api/v1/cards")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/v1/cards/8888999900001111"))
                .andExpect(jsonPath("$.cardNumber").value("8888999900001111"))
                .andExpect(jsonPath("$.version").value(0))
                .andExpect(jsonPath("$.cvv").doesNotExist());

        mockMvc.perform(get("/api/v1/cards/8888999900001111"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customerId").value("000000005"))
                .andExpect(jsonPath("$.cvv").doesNotExist());

        CardXref xref = xrefs.findById("8888999900001111").orElseThrow();
        assertThat(xref.getAccountId()).isEqualTo("00000000005");
        assertThat(xref.getCustomerId()).isEqualTo("000000005");
    }

    @Test
    void createRejectsCardNumberThatIsNotSixteenDigits() throws Exception {
        String body = """
                {
                  "cardNumber": "12345",
                  "accountId": "00000000005",
                  "customerId": "000000005",
                  "cvv": "654",
                  "embossedName": "MARCUS CHEN",
                  "expiryDate": "2031-07-01",
                  "activeStatus": "Y"
                }
                """;

        mockMvc.perform(post("/api/v1/cards")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }
}
