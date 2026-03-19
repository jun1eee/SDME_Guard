package com.ssafy.sdme.vendor.repository;

import com.ssafy.sdme.vendor.domain.VendorPackageItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VendorPackageItemRepository extends JpaRepository<VendorPackageItem, Long> {
    List<VendorPackageItem> findByPackageId(Long packageId);
}
