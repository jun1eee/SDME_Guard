package com.ssafy.sdme.reservation.controller;

import com.ssafy.sdme._global.ApiResponse;
import com.ssafy.sdme._global.common.constant.ApiPath;
import com.ssafy.sdme.reservation.domain.Reservation;
import com.ssafy.sdme.reservation.dto.ReservationRequest;
import com.ssafy.sdme.reservation.dto.ReservationResponse;
import com.ssafy.sdme.reservation.service.ReservationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Reservation", description = "예약 API")
@Slf4j
@RestController
@RequestMapping(ApiPath.PATH + "/reservations")
@RequiredArgsConstructor
public class ReservationController {

    private final ReservationService reservationService;

    @Operation(summary = "예약 생성", description = "업체에 예약을 생성합니다.")
    @PostMapping
    public ApiResponse<Reservation> createReservation(@RequestBody ReservationRequest reservationRequest,
                                                       HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        return ApiResponse.ok(reservationService.createReservation(userId, reservationRequest));
    }

    @Operation(summary = "예약 내역 조회", description = "커플의 예약 내역을 조회합니다.")
    @GetMapping
    public ApiResponse<List<ReservationResponse>> getReservations(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        return ApiResponse.ok(reservationService.getReservations(userId));
    }

    @Operation(summary = "예약 변경", description = "예약 정보를 변경합니다.")
    @PutMapping("/{reservationId}")
    public ApiResponse<Reservation> updateReservation(@PathVariable Long reservationId,
                                                       @RequestBody ReservationRequest reservationRequest) {
        return ApiResponse.ok(reservationService.updateReservation(reservationId, reservationRequest));
    }

    @Operation(summary = "예약 취소", description = "예약을 취소합니다.")
    @DeleteMapping("/{reservationId}")
    public ApiResponse<Void> cancelReservation(@PathVariable Long reservationId) {
        reservationService.cancelReservation(reservationId);
        return ApiResponse.ok(null);
    }
}
