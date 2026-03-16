package com.ssafy.sdme.auth.controller;

import com.ssafy.sdme._global.ApiResponse;
import com.ssafy.sdme._global.common.constant.ApiPath;
import com.ssafy.sdme._global.common.constant.ExpiredTime;
import com.ssafy.sdme._global.common.util.CookieUtil;
import com.ssafy.sdme.auth.dto.request.KakaoLoginRequest;
import com.ssafy.sdme.auth.dto.request.SignupRequest;
import com.ssafy.sdme.auth.dto.response.LoginResponse;
import com.ssafy.sdme.auth.dto.response.SignupResponse;
import com.ssafy.sdme.auth.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.CookieValue;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Auth", description = "인증 관련 (카카오 로그인/회원가입/로그아웃) API")
@Slf4j
@RestController
@RequestMapping(ApiPath.PATH + "/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Operation(summary = "카카오 로그인", description = "카카오 인가 코드로 로그인합니다. 신규/기존 모두 JWT를 발급합니다.")
    @PostMapping("/kakao")
    public ApiResponse<LoginResponse> kakaoLogin(@RequestBody KakaoLoginRequest request, HttpServletResponse response) {
        log.info("[AuthController] 카카오 로그인 요청");

        LoginResponse loginResponse = authService.kakaoLogin(request.getAuthorizationCode());

        response.setHeader("Authorization", "Bearer " + loginResponse.getAccessToken());
        response.addCookie(CookieUtil.createCookie("refresh", loginResponse.getRefreshToken(), ExpiredTime.COOKIE_REFRESH_MAX_AGE));

        return ApiResponse.ok(loginResponse);
    }

    @Operation(summary = "회원가입", description = "로그인 후 추가 정보를 입력합니다. (JWT 필요)")
    @PostMapping("/signup")
    public ApiResponse<SignupResponse> signup(@Valid @RequestBody SignupRequest request, HttpServletRequest httpRequest) {
        Long userId = (Long) httpRequest.getAttribute("userId");
        log.info("[AuthController] 회원가입 요청 - userId: {}", userId);

        SignupResponse signupResponse = authService.signup(userId, request);

        return ApiResponse.created(signupResponse);
    }

    @Operation(summary = "토큰 재발급", description = "refreshToken으로 새 accessToken/refreshToken을 발급합니다.")
    @PostMapping("/reissue")
    public ApiResponse<LoginResponse> reissue(@CookieValue(name = "refresh", required = false) String refreshToken,
                                               HttpServletResponse response) {
        log.info("[AuthController] 토큰 재발급 요청");

        LoginResponse loginResponse = authService.reissue(refreshToken);

        response.setHeader("Authorization", "Bearer " + loginResponse.getAccessToken());
        response.addCookie(CookieUtil.createCookie("refresh", loginResponse.getRefreshToken(), ExpiredTime.COOKIE_REFRESH_MAX_AGE));

        return ApiResponse.ok(loginResponse);
    }

    @Operation(summary = "로그아웃", description = "로그아웃 처리합니다. (JWT 필요)")
    @PostMapping("/logout")
    public ApiResponse<Void> logout(HttpServletResponse response) {
        log.info("[AuthController] 로그아웃 요청");

        response.addCookie(CookieUtil.createCookie("refresh", null, ExpiredTime.COOKIE_DELETE_AGE));

        return ApiResponse.ok(null);
    }
}
