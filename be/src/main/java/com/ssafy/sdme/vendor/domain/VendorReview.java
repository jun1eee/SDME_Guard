package com.ssafy.sdme.vendor.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Entity
@Table(name = "REVIEW")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VendorReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "couple_id", nullable = false)
    private Long coupleId;

    @Column(name = "vendor_id", nullable = false)
    private Long vendorId;

    @Column(name = "reservation_id", nullable = false)
    private Long reservationId;

    @Column(nullable = false)
    private Float rating;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Builder
    private VendorReview(Long coupleId, Long vendorId, Long reservationId, Float rating, String content) {
        this.coupleId      = coupleId;
        this.vendorId      = vendorId;
        this.reservationId = reservationId;
        this.rating        = rating;
        this.content       = content;
        this.createdAt     = LocalDateTime.now();
        this.updatedAt     = LocalDateTime.now();
    }

    public void update(Float rating, String content) {
        this.rating    = rating;
        this.content   = content;
        this.updatedAt = LocalDateTime.now();
    }

    public void softDelete() {
        this.deletedAt = LocalDateTime.now();
    }
}
