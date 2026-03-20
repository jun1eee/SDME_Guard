package com.ssafy.sdme.payment.controller;

import com.ssafy.sdme._global.ApiResponse;
import com.ssafy.sdme._global.common.constant.ApiPath;
import com.ssafy.sdme.payment.dto.PaymentRequest;
import com.ssafy.sdme.payment.dto.PaymentResponse;
import com.ssafy.sdme.payment.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Payment", description = "결제 API")
@RestController
@RequestMapping(ApiPath.PATH + "/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    @Operation(summary = "결제 요청", description = "등록된 카드로 결제를 요청합니다.")
    @PostMapping
    public ApiResponse<PaymentResponse> processPayment(@RequestBody PaymentRequest request,
                                                        HttpServletRequest httpRequest) {
        Long userId = (Long) httpRequest.getAttribute("userId");
        return ApiResponse.ok(paymentService.processPayment(userId, request));
    }

    @Operation(summary = "결제 내역 조회", description = "커플의 결제 내역을 조회합니다.")
    @GetMapping
    public ApiResponse<List<PaymentResponse>> getPayments(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        return ApiResponse.ok(paymentService.getPayments(userId));
    }

    @Operation(summary = "업체별 결제 진행상태 조회", description = "특정 업체의 결제 진행상태를 조회합니다.")
    @GetMapping("/vendor/{vendorId}")
    public ApiResponse<List<PaymentResponse>> getVendorPayments(@PathVariable Long vendorId,
                                                                  HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        return ApiResponse.ok(paymentService.getVendorPayments(userId, vendorId));
    }
}
