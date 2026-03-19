package com.ssafy.sdme.vendor.repository;

import com.ssafy.sdme.vendor.domain.VendorReport;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VendorReportRepository extends JpaRepository<VendorReport, Long> {
}
