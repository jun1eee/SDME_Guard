package com.ssafy.sdme.vendor.repository;

import com.ssafy.sdme.vendor.domain.VendorReview;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VendorReviewRepository extends JpaRepository<VendorReview, Long> {

    List<VendorReview> findByVendorIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long vendorId);

    List<VendorReview> findByCoupleIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long coupleId);

    boolean existsByCoupleIdAndVendorIdAndDeletedAtIsNull(Long coupleId, Long vendorId);
}
