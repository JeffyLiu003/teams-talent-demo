package com.carddemo.customer.application;

import com.carddemo.customer.domain.exception.BusinessRuleException;
import com.carddemo.customer.domain.exception.NotFoundException;
import com.carddemo.customer.domain.model.Customer;
import com.carddemo.customer.domain.model.CustomerDetails;
import com.carddemo.customer.domain.repository.CustomerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 客户用例服务。对应遗留程序 COACTVWC 的客户部分（查询）与 COACTUPC 的客户段（维护），
 * 新增客户对应 CBIMPORT 的导入语义（NR-CUST-01）。
 */
@Service
@Transactional
public class CustomerApplicationService {

    private static final int DEFAULT_PAGE_SIZE = 10;
    private static final int MAX_PAGE_SIZE = 100;

    private final CustomerRepository customers;

    public CustomerApplicationService(CustomerRepository customers) {
        this.customers = customers;
    }

    @Transactional(readOnly = true)
    public PageResult<Customer> list(int page, int size) {
        int safePage = page < 0 ? 0 : page;
        int safeSize = size <= 0 ? DEFAULT_PAGE_SIZE : Math.min(size, MAX_PAGE_SIZE);
        return new PageResult<>(customers.findAllCustomers(safePage, safeSize), safePage, safeSize,
                customers.countCustomers());
    }

    @Transactional(readOnly = true)
    public Customer getById(String customerId) {
        return customers.findByCustomerId(customerId)
                .orElseThrow(() -> new NotFoundException("CUSTOMER_NOT_FOUND",
                        "Customer " + customerId + " not found"));
    }

    public Customer create(String customerId, CustomerDetails details) {
        Customer customer = new Customer(customerId, details);
        if (customers.existsByCustomerId(customer.getCustomerId())) {
            throw new BusinessRuleException("CUSTOMER_ALREADY_EXISTS",
                    "Customer " + customer.getCustomerId() + " already exists");
        }
        return customers.saveCustomer(customer);
    }

    public Customer update(String customerId, CustomerDetails details) {
        Customer customer = getById(customerId);
        customer.applyDetails(details);
        return customers.saveCustomer(customer);
    }
}
