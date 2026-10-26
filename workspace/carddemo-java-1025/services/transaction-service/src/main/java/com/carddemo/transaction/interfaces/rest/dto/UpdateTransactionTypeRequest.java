package com.carddemo.transaction.interfaces.rest.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateTransactionTypeRequest(
        @NotBlank(message = "Description must be supplied.")
        @Size(max = 50, message = "Description must be 50 characters.")
        String description) {
}
