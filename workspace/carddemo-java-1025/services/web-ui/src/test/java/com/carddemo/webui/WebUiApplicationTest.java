package com.carddemo.webui;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class WebUiApplicationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void servesSpaAtRoot() throws Exception {
        mockMvc.perform(get("/"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/index.html"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("CardDemo")));
    }

    @Test
    void unknownApiPathReturnsRouteNotFound() throws Exception {
        mockMvc.perform(get("/api/v1/unknown"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ROUTE_NOT_FOUND"));
    }
}
