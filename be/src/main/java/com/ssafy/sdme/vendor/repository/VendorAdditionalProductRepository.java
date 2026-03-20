package com.ssafy.sdme.vendor.repository;

import com.ssafy.sdme.vendor.domain.VendorAdditionalProduct;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VendorAdditionalProductRepository extends JpaRepository<VendorAdditionalProduct, Long> {
    List<VendorAdditionalProduct> findByVendorId(Long vendorId);
}
