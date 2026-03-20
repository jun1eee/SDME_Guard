package com.ssafy.sdme.vendor.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "VENDOR_REPORT")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VendorReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "couple_id", nullable = false)
    private Long coupleId;

    @Column(name = "vendor_id", nullable = false)
    private Long vendorId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Enumerated(EnumType.STRING)
    private ReportStatus status;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Builder
    public VendorReport(Long coupleId, Long vendorId, String reason) {
        this.coupleId = coupleId;
        this.vendorId = vendorId;
        this.reason = reason;
        this.status = ReportStatus.PENDING;
        this.createdAt = LocalDateTime.now();
    }

    public enum ReportStatus {
        PENDING, APPROVED, REJECTED
    }
}
