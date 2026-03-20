package com.ssafy.sdme.reservation.dto;

import com.ssafy.sdme.reservation.domain.Reservation;
import com.ssafy.sdme.vendor.domain.Vendor;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Getter
@Builder
public class ReservationResponse {
    private Long id;
    private Long coupleId;
    private Long vendorId;
    private String vendorName;
    private String category;
    private String imageUrl;
    private LocalDate reservationDate;
    private LocalDate serviceDate;
    private LocalTime reservationTime;
    private String status;
    private String progress;
    private String memo;
    private LocalDateTime createdAt;

    public static ReservationResponse of(Reservation reservation, Vendor vendor) {
        return ReservationResponse.builder()
                .id(reservation.getId())
                .coupleId(reservation.getCoupleId())
                .vendorId(reservation.getVendorId())
                .vendorName(vendor != null ? vendor.getName() : "알 수 없는 업체")
                .category(vendor != null ? vendor.getCategory() : "")
                .imageUrl(vendor != null ? vendor.getImageUrl() : "")
                .reservationDate(reservation.getReservationDate())
                .serviceDate(reservation.getServiceDate())
                .reservationTime(reservation.getReservationTime())
                .status(reservation.getStatus().name())
                .progress(reservation.getProgress() != null ? reservation.getProgress().name() : "")
                .memo(reservation.getMemo())
                .createdAt(reservation.getCreatedAt())
                .build();
    }
}
