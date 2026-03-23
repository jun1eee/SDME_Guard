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
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping(ApiPath.PATH + "/reviews/{reviewId}")
public class ReviewController {

    private final VendorReviewService vendorReviewService;
    private final JwtUtil jwtUtil;

    @PutMapping
    public ApiResponse<VendorReviewResponse> updateReview(
        @PathVariable Long reviewId,
        @RequestBody VendorReviewRequest request,
        HttpServletRequest httpRequest
    ) {
        Long userId = extractUserId(httpRequest);
        log.info("[Review] 리뷰 수정 - reviewId: {}, userId: {}", reviewId, userId);
        return ApiResponse.ok(vendorReviewService.updateReview(reviewId, userId, request));
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteReview(
        @PathVariable Long reviewId,
        HttpServletRequest httpRequest
    ) {
        Long userId = extractUserId(httpRequest);
        log.info("[Review] 리뷰 삭제 - reviewId: {}, userId: {}", reviewId, userId);
        vendorReviewService.deleteReview(reviewId, userId);
        return ResponseEntity.noContent().build();
    }

    private Long extractUserId(HttpServletRequest httpRequest) {
        String authorization = httpRequest.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new UnauthorizedException("로그인이 필요합니다.");
        }
        return jwtUtil.getUserId(authorization.substring(7));
    }
}