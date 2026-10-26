package com.carddemo.customer.interfaces.rest;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class CustomerControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void listsSeededCustomersByCustomerId() throws Exception {
        mockMvc.perform(get("/api/v1/customers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.total").value(8))
                .andExpect(jsonPath("$.items.length()").value(8))
                .andExpect(jsonPath("$.items[0].customerId").value("000000001"))
                .andExpect(jsonPath("$.items[7].customerId").value("000000008"))
                .andExpect(jsonPath("$.items[0].ssnMasked").value("***-**-6789"))
                .andExpect(jsonPath("$.items[0].ssn").doesNotExist());
    }

    @Test
    void returnsSeededCustomerWithMaskedSsn() throws Exception {
        mockMvc.perform(get("/api/v1/customers/{customerId}", "000000001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customerId").value("000000001"))
                .andExpect(jsonPath("$.firstName").value("Immanuel"))
                .andExpect(jsonPath("$.lastName").value("Kessler"))
                .andExpect(jsonPath("$.addressLine3").value("Altenwerthshire"))
                .andExpect(jsonPath("$.stateCode").value("NY"))
                .andExpect(jsonPath("$.zipCode").value("10001"))
                .andExpect(jsonPath("$.phoneNumber1").value("(212)555-0101"))
                .andExpect(jsonPath("$.ssnMasked").value("***-**-6789"))
                .andExpect(jsonPath("$.primaryCardHolder").value("Y"))
                .andExpect(jsonPath("$.ficoScore").value(720))
                .andExpect(jsonPath("$.ssn").doesNotExist())
                .andExpect(jsonPath("$.password").doesNotExist());
    }

    @Test
    void returns404ForUnknownCustomer() throws Exception {
        mockMvc.perform(get("/api/v1/customers/{customerId}", "999999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CUSTOMER_NOT_FOUND"));
    }

    @Test
    void updatesCustomerAndKeepsOmittedSsn() throws Exception {
        mockMvc.perform(put("/api/v1/customers/{customerId}", "000000001")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Immanuel", "Kessler Smith", "NY", "10001", 720)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastName").value("Kessler Smith"))
                .andExpect(jsonPath("$.phoneNumber1").value("(212)555-0199"))
                .andExpect(jsonPath("$.ssnMasked").value("***-**-6789"));

        mockMvc.perform(get("/api/v1/customers/{customerId}", "000000001"))
                .andExpect(jsonPath("$.lastName").value("Kessler Smith"))
                .andExpect(jsonPath("$.ssnMasked").value("***-**-6789"));
    }

    @Test
    void rejectsInvalidStateCodeWith400() throws Exception {
        mockMvc.perform(put("/api/v1/customers/{customerId}", "000000002")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Enrico", "Rosenbaum", "ZZ", "90002", 680)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.details[0]").value("stateCode: State: is not a valid state code."));
    }

    @Test
    void rejectsZeroZipCodeWith400() throws Exception {
        mockMvc.perform(put("/api/v1/customers/{customerId}", "000000002")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Enrico", "Rosenbaum", "CA", "00000", 680)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.details[0]").value("zipCode: Zip code cannot be zero."));
    }

    @Test
    void rejectsFicoScoreOutOfRangeWith400() throws Exception {
        mockMvc.perform(put("/api/v1/customers/{customerId}", "000000002")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Enrico", "Rosenbaum", "CA", "90002", 900)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.details[0]").value("ficoScore: FICO Score must be between 300 and 850."));
    }

    @Test
    void returns404WhenUpdatingUnknownCustomer() throws Exception {
        mockMvc.perform(put("/api/v1/customers/{customerId}", "999999999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Ghost", "Customer", "CA", "90002", 700)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CUSTOMER_NOT_FOUND"));
    }

    @Test
    void createsCustomerAndReturns201() throws Exception {
        String request = """
                {
                  "customerId": "000000009", "firstName": "Grace", "middleName": "B",
                  "lastName": "Hopper", "addressLine1": "1 Navy Way", "addressLine2": null,
                  "addressLine3": "Arlington", "stateCode": "VA", "countryCode": "USA",
                  "zipCode": "22201", "phoneNumber1": "7035550109", "phoneNumber2": null,
                  "ssn": "876543210", "dateOfBirth": "1906-12-09", "eftAccountId": "0000000009",
                  "primaryCardHolder": "N", "ficoScore": 800
                }
                """;

        mockMvc.perform(post("/api/v1/customers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.customerId").value("000000009"))
                .andExpect(jsonPath("$.phoneNumber1").value("(703)555-0109"))
                .andExpect(jsonPath("$.ssnMasked").value("***-**-3210"))
                .andExpect(jsonPath("$.ssn").doesNotExist());

        mockMvc.perform(get("/api/v1/customers")).andExpect(jsonPath("$.total").value(9));
    }

    @Test
    void rejectsDuplicateCustomerWith409() throws Exception {
        String request = """
                {
                  "customerId": "000000001", "firstName": "Immanuel", "middleName": "Madeline",
                  "lastName": "Kessler", "addressLine1": "618 Deshaun Route",
                  "addressLine2": "Apt. 802", "addressLine3": "Altenwerthshire",
                  "stateCode": "NY", "countryCode": "USA", "zipCode": "10001",
                  "phoneNumber1": "2125550101", "phoneNumber2": null,
                  "ssn": "123456789", "dateOfBirth": "1985-04-12", "eftAccountId": "0000000001",
                  "primaryCardHolder": "Y", "ficoScore": 720
                }
                """;

        mockMvc.perform(post("/api/v1/customers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CUSTOMER_ALREADY_EXISTS"));
    }

    @Test
    void rejectsCustomerIdWithWrongLengthWith400() throws Exception {
        String request = """
                {
                  "customerId": "00000001", "firstName": "Grace", "lastName": "Hopper",
                  "addressLine1": "1 Navy Way", "addressLine3": "Arlington",
                  "stateCode": "VA", "countryCode": "USA", "zipCode": "22201",
                  "ssn": "876543210", "dateOfBirth": "1906-12-09", "eftAccountId": "0000000009",
                  "primaryCardHolder": "N", "ficoScore": 800
                }
                """;

        mockMvc.perform(post("/api/v1/customers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    private String body(String firstName, String lastName, String stateCode, String zipCode,
                        int ficoScore) {
        return """
                {
                  "firstName": "%s", "middleName": "Madeline", "lastName": "%s",
                  "addressLine1": "618 Deshaun Route", "addressLine2": "Apt. 802",
                  "addressLine3": "Altenwerthshire", "stateCode": "%s", "countryCode": "USA",
                  "zipCode": "%s", "phoneNumber1": "2125550199", "phoneNumber2": null,
                  "dateOfBirth": "1985-04-12", "eftAccountId": "0000000001",
                  "primaryCardHolder": "Y", "ficoScore": %d
                }
                """.formatted(firstName, lastName, stateCode, zipCode, ficoScore);
    }
}
