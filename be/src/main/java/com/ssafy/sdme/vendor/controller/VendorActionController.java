package com.ssafy.sdme.vendor.controller;

import com.ssafy.sdme._global.ApiResponse;
import com.ssafy.sdme._global.common.constant.ApiPath;
import com.ssafy.sdme.reservation.domain.Reservation;
import com.ssafy.sdme.reservation.dto.ReservationRequest;
import com.ssafy.sdme.reservation.service.ReservationService;
import com.ssafy.sdme.vendor.application.VendorActionService;
import com.ssafy.sdme.vendor.dto.VendorReportRequest;
import com.ssafy.sdme.vendor.dto.VendorShareRequest;
import com.ssafy.sdme.vendor.dto.VendorShareResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "VendorAction", description = "업체 공유/신고/진행상태 API")
@Slf4j
@RestController
@RequestMapping(ApiPath.PATH + "/vendors")
@RequiredArgsConstructor
public class VendorActionController {

    private final VendorActionService vendorActionService;
    private final ReservationService reservationService;

    @Operation(summary = "업체 예약", description = "업체를 예약합니다.")
    @PostMapping("/{vendorId}/book")
    public ApiResponse<Reservation> bookVendor(@PathVariable Long vendorId,
                                                @RequestBody ReservationRequest reservationRequest,
                                                HttpServletRequest httpRequest) {
        Long userId = (Long) httpRequest.getAttribute("userId");
        return ApiResponse.created(reservationService.createReservation(userId, reservationRequest));
    }

    @Operation(summary = "업체 공유", description = "업체를 커플에게 공유합니다.")
    @PostMapping("/{vendorId}/share")
    public ApiResponse<VendorShareResponse> shareVendor(@PathVariable Long vendorId,
                                                         @RequestBody(required = false) VendorShareRequest request,
                                                         HttpServletRequest httpRequest) {
        Long userId = (Long) httpRequest.getAttribute("userId");
        String message = request != null ? request.getMessage() : null;
        return ApiResponse.created(vendorActionService.shareVendor(userId, vendorId, message));
    }

    @Operation(summary = "공유 업체 목록 조회", description = "커플이 공유한 업체 목록을 조회합니다.")
    @GetMapping("/shared")
    public ApiResponse<List<VendorShareResponse>> getSharedVendors(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        return ApiResponse.ok(vendorActionService.getSharedVendors(userId));
    }

    @Operation(summary = "공유 업체 삭제", description = "공유한 업체를 삭제합니다.")
    @DeleteMapping("/{vendorId}/share")
    public ApiResponse<Void> unshareVendor(@PathVariable Long vendorId, HttpServletRequest httpRequest) {
        Long userId = (Long) httpRequest.getAttribute("userId");
        vendorActionService.unshareVendor(userId, vendorId);
        return ApiResponse.ok(null);
    }

    @Operation(summary = "업체 신고", description = "업체를 신고합니다.")
    @PostMapping("/{vendorId}/report")
    public ApiResponse<Void> reportVendor(@PathVariable Long vendorId,
                                           @RequestBody VendorReportRequest request,
                                           HttpServletRequest httpRequest) {
        Long userId = (Long) httpRequest.getAttribute("userId");
        vendorActionService.reportVendor(userId, vendorId, request.getReason());
        return ApiResponse.ok(null);
    }

    @Operation(summary = "업체 진행 상태 업데이트", description = "업체의 결제 진행 상태를 업데이트합니다.")
    @PutMapping("/{vendorId}/progress")
    public ApiResponse<Void> updateProgress(@PathVariable Long vendorId,
                                             @RequestBody java.util.Map<String, String> body,
                                             HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        vendorActionService.updateProgress(userId, vendorId, body.get("progress"));
        return ApiResponse.ok(null);
    }
}
