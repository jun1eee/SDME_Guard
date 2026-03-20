package com.ssafy.sdme.vendor.repository;

import com.ssafy.sdme.vendor.domain.Vendor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VendorRepository extends JpaRepository<Vendor, Long> {
    boolean existsBySourceId(Long sourceId);
    Optional<Vendor> findBySourceId(Long sourceId);
    long countByCategory(String category);
    List<Vendor> findByNameAndCategory(String name, String category);
    List<Vendor> findAllByCategory(String category);
}
