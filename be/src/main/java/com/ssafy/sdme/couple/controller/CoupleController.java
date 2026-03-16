package com.ssafy.sdme.couple.controller;

import com.ssafy.sdme._global.ApiResponse;
import com.ssafy.sdme._global.common.constant.ApiPath;
import com.ssafy.sdme.couple.dto.request.CoupleConnectRequest;
import com.ssafy.sdme.couple.dto.response.CoupleConnectResponse;
import com.ssafy.sdme.couple.dto.response.CoupleInviteResponse;
import com.ssafy.sdme.couple.dto.response.CoupleResponse;
import com.ssafy.sdme.couple.service.CoupleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Couple", description = "커플 매칭 관련 API")
@Slf4j
@RestController
@RequestMapping(ApiPath.PATH + "/couples")
@RequiredArgsConstructor
public class CoupleController {

    private final CoupleService coupleService;

    @Operation(summary = "내 커플 정보 조회", description = "로그인한 사용자의 커플 정보를 조회합니다.")
    @GetMapping("/me")
    public ApiResponse<CoupleResponse> getMyCouple(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        log.info("[CoupleController] 커플 정보 조회 - userId: {}", userId);
        return ApiResponse.ok(coupleService.getMyCouple(userId));
    }

    @Operation(summary = "초대코드 생성", description = "커플 매칭을 위한 6자리 초대코드를 생성합니다.")
    @PostMapping("/invite")
    public ApiResponse<CoupleInviteResponse> createInviteCode(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        log.info("[CoupleController] 초대코드 생성 - userId: {}", userId);
        return ApiResponse.ok(coupleService.createInviteCode(userId));
    }

    @Operation(summary = "커플 매칭", description = "상대방의 초대코드를 입력하여 커플을 매칭합니다.")
    @PostMapping("/connect")
    public ApiResponse<CoupleConnectResponse> connect(@Valid @RequestBody CoupleConnectRequest connectRequest,
                                                       HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        log.info("[CoupleController] 커플 매칭 요청 - userId: {}, code: {}", userId, connectRequest.getInviteCode());
        return ApiResponse.ok(coupleService.connect(userId, connectRequest.getInviteCode()));
    }
}
