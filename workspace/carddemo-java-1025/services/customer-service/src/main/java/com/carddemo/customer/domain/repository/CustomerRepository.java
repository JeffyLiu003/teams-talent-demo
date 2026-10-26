package com.carddemo.customer.domain.repository;

import com.carddemo.customer.domain.model.Customer;

import java.util.List;
import java.util.Optional;

/**
 * 客户仓储端口。实现见 infrastructure.persistence.CustomerJpaRepository。
 */
public interface CustomerRepository {

    Optional<Customer> findByCustomerId(String customerId);

    boolean existsByCustomerId(String customerId);

    Customer saveCustomer(Customer customer);

    /**
     * BR-CUST-01：按客户号升序分页（客户号为 9 位零填充字符串，字典序即数值序）。
     */
    List<Customer> findAllCustomers(int page, int size);

    long countCustomers();
}
