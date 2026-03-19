package com.ssafy.sdme.reservation.dto;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalTime;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ReservationRequest {
    private Long vendorId;
    private Long hallDetailId;
    private LocalDate reservationDate;
    private LocalDate serviceDate;
    private LocalTime reservationTime;
    private String memo;
}
