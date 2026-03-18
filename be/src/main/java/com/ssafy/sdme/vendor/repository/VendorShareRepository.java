package com.ssafy.sdme.vendor.repository;

import com.ssafy.sdme.vendor.domain.VendorShare;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VendorShareRepository extends JpaRepository<VendorShare, Long> {
    List<VendorShare> findByCoupleIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long coupleId);
    boolean existsBySharedUserIdAndVendorIdAndDeletedAtIsNull(Long sharedUserId, Long vendorId);
    java.util.Optional<VendorShare> findBySharedUserIdAndVendorIdAndDeletedAtIsNull(Long sharedUserId, Long vendorId);
}
