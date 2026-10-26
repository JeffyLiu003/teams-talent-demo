package com.carddemo.iam.interfaces.rest.dto;

import jakarta.validation.constraints.NotBlank;

public record VerifyTokenRequest(
        @NotBlank(message = "Token must be supplied.")
        String token) {
}
