package com.carddemo.customer.interfaces.rest;

import com.carddemo.customer.application.CustomerApplicationService;
import com.carddemo.customer.application.PageResult;
import com.carddemo.customer.domain.model.Customer;
import com.carddemo.customer.interfaces.rest.dto.CreateCustomerRequest;
import com.carddemo.customer.interfaces.rest.dto.CustomerResponse;
import com.carddemo.customer.interfaces.rest.dto.PageResponse;
import com.carddemo.customer.interfaces.rest.dto.UpdateCustomerRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/customers")
public class CustomerController {

    private final CustomerApplicationService customerService;

    public CustomerController(CustomerApplicationService customerService) {
        this.customerService = customerService;
    }

    @GetMapping
    public PageResponse<CustomerResponse> list(@RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "10") int size) {
        PageResult<Customer> result = customerService.list(page, size);
        List<CustomerResponse> items = result.items().stream().map(CustomerResponse::from).toList();
        return new PageResponse<>(items, result.page(), result.size(), result.total());
    }

    @GetMapping("/{customerId}")
    public CustomerResponse get(@PathVariable String customerId) {
        return CustomerResponse.from(customerService.getById(customerId));
    }

    @PostMapping
    public ResponseEntity<CustomerResponse> create(@Valid @RequestBody CreateCustomerRequest request) {
        Customer created = customerService.create(request.customerId(), request.toDetails());
        return ResponseEntity.status(HttpStatus.CREATED).body(CustomerResponse.from(created));
    }

    @PutMapping("/{customerId}")
    public CustomerResponse update(@PathVariable String customerId,
                                   @Valid @RequestBody UpdateCustomerRequest request) {
        return CustomerResponse.from(customerService.update(customerId, request.toDetails()));
    }
}
