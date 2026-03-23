package com.ssafy.sdme.vendor.controller;

import com.ssafy.sdme._global.ApiResponse;
import com.ssafy.sdme._global.common.constant.ApiPath;
import com.ssafy.sdme._global.exception.UnauthorizedException;
import com.ssafy.sdme.auth.jwt.JwtUtil;
import com.ssafy.sdme.vendor.application.VendorReviewService;
import com.ssafy.sdme.vendor.dto.MyReviewResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping(ApiPath.PATH + "/vendors/my")
public class MyReviewController {

    private final VendorReviewService vendorReviewService;
    private final JwtUtil jwtUtil;

    @GetMapping
    public ApiResponse<List<MyReviewResponse>> getMyReviews(HttpServletRequest httpRequest) {
        String authorization = httpRequest.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new UnauthorizedException("로그인이 필요합니다.");
        }
        Long userId = jwtUtil.getUserId(authorization.substring(7));
        log.info("[Review] 내 리뷰 목록 조회 - userId: {}", userId);
        return ApiResponse.ok(vendorReviewService.getMyReviews(userId));
    }
}