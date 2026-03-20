package com.ssafy.sdme.vendor.repository;

import com.ssafy.sdme.vendor.domain.VendorHallDetail;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VendorHallDetailRepository extends JpaRepository<VendorHallDetail, Long> {

    List<VendorHallDetail> findByVendorId(Long vendorId);

    boolean existsByVendorId(Long vendorId);
}
