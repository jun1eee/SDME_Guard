package com.ssafy.sdme.reservation.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "RESERVATION")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Reservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "couple_id", nullable = false)
    private Long coupleId;

    @Column(name = "vendor_id", nullable = false)
    private Long vendorId;

    @Column(name = "hall_detail_id", nullable = false)
    private Long hallDetailId;

    @Column(name = "reservation_date")
    private LocalDate reservationDate;

    @Column(name = "service_date")
    private LocalDate serviceDate;

    @Column(name = "reservation_time")
    private LocalTime reservationTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReservationStatus status;

    @Enumerated(EnumType.STRING)
    private ReservationProgress progress;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(columnDefinition = "TEXT")
    private String memo;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Builder
    public Reservation(Long coupleId, Long vendorId, Long hallDetailId, LocalDate reservationDate,
                        LocalDate serviceDate, LocalTime reservationTime, String memo) {
        this.coupleId = coupleId;
        this.vendorId = vendorId;
        this.hallDetailId = hallDetailId;
        this.reservationDate = reservationDate;
        this.serviceDate = serviceDate;
        this.reservationTime = reservationTime;
        this.memo = memo;
        this.status = ReservationStatus.PENDING;
        this.progress = ReservationProgress.CONSULTING;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public void confirm() {
        this.status = ReservationStatus.CONFIRMED;
        this.updatedAt = LocalDateTime.now();
    }

    public void cancel() {
        this.status = ReservationStatus.CANCELLED;
        this.updatedAt = LocalDateTime.now();
    }

    public void updateProgress(ReservationProgress progress) {
        this.progress = progress;
        if (progress == ReservationProgress.COMPLETED) {
            this.completedAt = LocalDateTime.now();
        }
        this.updatedAt = LocalDateTime.now();
    }

    public void update(LocalDate reservationDate, LocalDate serviceDate, LocalTime reservationTime, String memo) {
        if (reservationDate != null) this.reservationDate = reservationDate;
        if (serviceDate != null) this.serviceDate = serviceDate;
        if (reservationTime != null) this.reservationTime = reservationTime;
        if (memo != null) this.memo = memo;
        this.updatedAt = LocalDateTime.now();
    }

    public enum ReservationStatus {
        PENDING, CONFIRMED, CANCELLED
    }

    public enum ReservationProgress {
        CONSULTING, DEPOSIT_PAID, IN_PROGRESS, BALANCE_PAID, COMPLETED
    }
}
