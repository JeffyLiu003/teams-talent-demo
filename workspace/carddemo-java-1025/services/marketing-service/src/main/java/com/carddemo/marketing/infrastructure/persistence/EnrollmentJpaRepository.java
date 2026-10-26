package com.carddemo.marketing.infrastructure.persistence;

import com.carddemo.marketing.domain.model.Enrollment;
import com.carddemo.marketing.domain.repository.EnrollmentRepository;
import com.carddemo.marketing.domain.repository.PageResult;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EnrollmentJpaRepository extends JpaRepository<Enrollment, String>, EnrollmentRepository {

    @Override
    default Optional<Enrollment> findEnrollment(String campaignId, String cardNumber) {
        return findByCampaignIdAndCardNumber(campaignId, cardNumber);
    }

    @Override
    default Enrollment saveEnrollment(Enrollment enrollment) {
        return save(enrollment);
    }

    @Override
    default PageResult<Enrollment> findEnrollments(String campaignId, int page, int size) {
        Page<Enrollment> result = findAllByCampaignIdOrderByEnrolledAtDesc(
                campaignId, PageRequest.of(page, size));
        return new PageResult<>(result.getContent(), page, size, result.getTotalElements());
    }

    @Override
    default long countByCampaign(String campaignId) {
        return countByCampaignId(campaignId);
    }

    Optional<Enrollment> findByCampaignIdAndCardNumber(String campaignId, String cardNumber);

    Page<Enrollment> findAllByCampaignIdOrderByEnrolledAtDesc(String campaignId,
                                                              org.springframework.data.domain.Pageable pageable);

    long countByCampaignId(String campaignId);
}
