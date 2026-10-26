package com.carddemo.transaction.interfaces.rest;

import com.carddemo.transaction.application.ReferenceDataService;
import com.carddemo.transaction.interfaces.rest.dto.TransactionCategoryResponse;
import com.carddemo.transaction.interfaces.rest.dto.TransactionTypeResponse;
import com.carddemo.transaction.interfaces.rest.dto.UpdateTransactionTypeRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class ReferenceDataController {

    private final ReferenceDataService referenceDataService;

    public ReferenceDataController(ReferenceDataService referenceDataService) {
        this.referenceDataService = referenceDataService;
    }

    @GetMapping("/transaction-types")
    public Map<String, List<TransactionTypeResponse>> transactionTypes() {
        List<TransactionTypeResponse> items = referenceDataService.listTypes().stream()
                .map(TransactionTypeResponse::from)
                .toList();
        return Map.of("items", items);
    }

    @GetMapping("/transaction-categories")
    public Map<String, List<TransactionCategoryResponse>> transactionCategories(
            @RequestParam(required = false) String typeCode) {
        List<TransactionCategoryResponse> items = referenceDataService.listCategories(typeCode).stream()
                .map(TransactionCategoryResponse::from)
                .toList();
        return Map.of("items", items);
    }

    @PutMapping("/transaction-types/{typeCode}")
    public TransactionTypeResponse updateType(@PathVariable String typeCode,
                                             @Valid @RequestBody UpdateTransactionTypeRequest request) {
        return TransactionTypeResponse.from(
                referenceDataService.updateTypeDescription(typeCode, request.description()));
    }
}
