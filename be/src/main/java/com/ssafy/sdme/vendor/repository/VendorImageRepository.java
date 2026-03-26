package com.ssafy.sdme.vendor.repository;

import com.ssafy.sdme.vendor.domain.VendorImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VendorImageRepository extends JpaRepository<VendorImage, Long> {
    List<VendorImage> findByVendorIdOrderByOrderNum(Long vendorId);
    List<VendorImage> findByVendorIdIn(List<Long> vendorIds);
}
