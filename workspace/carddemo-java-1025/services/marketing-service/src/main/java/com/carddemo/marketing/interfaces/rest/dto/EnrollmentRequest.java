package com.carddemo.marketing.interfaces.rest.dto;

import com.carddemo.marketing.domain.model.Enrollment;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.time.LocalDateTime;
import java.util.List;

public record EnrollmentRequest(
        @Schema(example = "0500024453765740")
        @NotBlank(message = "Card Number must be supplied.")
        @Pattern(regexp = "\\d{16}", message = "Card Number must be 16 digits.")
        String cardNumber,

        @Schema(example = "00000000001")
        @NotBlank(message = "Account ID must be supplied.")
        @Pattern(regexp = "\\d{11}", message = "Account ID must be 11 digits.")
        String accountId,

        @Pattern(regexp = "^$|\\d{9}", message = "Customer ID must be 9 digits.")
        String customerId) {

    public record Response(String enrollmentId, String campaignId, String cardNumber,
                           String accountId, String customerId, LocalDateTime enrolledAt) {

        public static Response from(Enrollment enrollment) {
            return new Response(enrollment.getEnrollmentId(), enrollment.getCampaignId(),
                    enrollment.getCardNumber(), enrollment.getAccountId(),
                    enrollment.getCustomerId(), enrollment.getEnrolledAt());
        }
    }

    public record Page(List<Response> items, int page, int size, long total) {
    }
}
