package com.carddemo.marketing.domain.repository;

import com.carddemo.marketing.domain.model.Enrollment;

import java.util.Optional;

public interface EnrollmentRepository {

    Optional<Enrollment> findEnrollment(String campaignId, String cardNumber);

    Enrollment saveEnrollment(Enrollment enrollment);

    PageResult<Enrollment> findEnrollments(String campaignId, int page, int size);

    long countByCampaign(String campaignId);
}
