package com.carddemo.transaction.interfaces.rest.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record PostingRequest(@NotEmpty @Valid List<PostingTransactionRequest> transactions) {
}
