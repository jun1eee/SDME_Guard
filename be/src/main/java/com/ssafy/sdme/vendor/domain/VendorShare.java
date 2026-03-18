package com.ssafy.sdme.vendor.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "VENDOR_SHARE")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VendorShare {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "couple_id", nullable = false)
    private Long coupleId;

    @Column(name = "vendor_id", nullable = false)
    private Long vendorId;

    @Column(name = "shared_user_id", nullable = false)
    private Long sharedUserId;

    @Column(columnDefinition = "TEXT")
    private String message;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "shared_at")
    private LocalDateTime sharedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Builder
    public VendorShare(Long coupleId, Long vendorId, Long sharedUserId, String message) {
        this.coupleId = coupleId;
        this.vendorId = vendorId;
        this.sharedUserId = sharedUserId;
        this.message = message;
        this.createdAt = LocalDateTime.now();
        this.sharedAt = LocalDateTime.now();
    }

    public void softDelete() {
        this.deletedAt = LocalDateTime.now();
    }
}
