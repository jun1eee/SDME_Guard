package com.ssafy.sdme.vendor.repository;

import com.ssafy.sdme.vendor.domain.VendorPackage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VendorPackageRepository extends JpaRepository<VendorPackage, Long> {
    List<VendorPackage> findByVendorId(Long vendorId);
    boolean existsByVendorId(Long vendorId);
}
