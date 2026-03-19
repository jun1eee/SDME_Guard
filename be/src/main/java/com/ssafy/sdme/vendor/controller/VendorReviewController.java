package com.ssafy.sdme.vendor.controller;

import com.ssafy.sdme._global.ApiResponse;
import com.ssafy.sdme._global.common.constant.ApiPath;
import com.ssafy.sdme._global.exception.UnauthorizedException;
import com.ssafy.sdme.auth.jwt.JwtUtil;
import com.ssafy.sdme.vendor.application.VendorReviewService;
import com.ssafy.sdme.vendor.dto.VendorReviewRequest;
import com.ssafy.sdme.vendor.dto.VendorReviewResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping(ApiPath.PATH + "/vendors/{vendorId}/reviews")
public class VendorReviewController {

    private final VendorReviewService vendorReviewService;
    private final JwtUtil jwtUtil;

    @GetMapping
    public ApiResponse<List<VendorReviewResponse>> getReviews(
        @PathVariable Long vendorId
    ) {
        log.info("[VendorReview] 리뷰 조회 - vendorId: {}", vendorId);
        return ApiResponse.ok(vendorReviewService.getReviews(vendorId));
    }

    @PostMapping
    public ApiResponse<VendorReviewResponse> createReview(
        @PathVariable Long vendorId,
        @RequestBody VendorReviewRequest request,
        HttpServletRequest httpRequest
    ) {
        String authorization = httpRequest.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new UnauthorizedException("로그인이 필요합니다.");
        }
        Long userId = jwtUtil.getUserId(authorization.substring(7));
        return ApiResponse.created(vendorReviewService.createReview(vendorId, userId, request));
    }
}
