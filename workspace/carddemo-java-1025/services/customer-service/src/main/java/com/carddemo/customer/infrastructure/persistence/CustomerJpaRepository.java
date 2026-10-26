package com.carddemo.customer.infrastructure.persistence;

import com.carddemo.customer.domain.model.Customer;
import com.carddemo.customer.domain.repository.CustomerRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CustomerJpaRepository extends JpaRepository<Customer, String>, CustomerRepository {

    boolean existsByCustomerId(String customerId);

    @Override
    default Optional<Customer> findByCustomerId(String customerId) {
        return findById(customerId);
    }

    @Override
    default Customer saveCustomer(Customer customer) {
        return save(customer);
    }

    @Override
    default List<Customer> findAllCustomers(int page, int size) {
        return findAll(PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "customerId")))
                .getContent();
    }

    @Override
    default long countCustomers() {
        return count();
    }
}
