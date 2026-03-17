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
import com.ssafy.sdme.auth.jwt.JwtUtil;
import com.ssafy.sdme.user.domain.User;
import com.ssafy.sdme.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;


@Tag(name = "Auth", description = "인증 관련 (카카오 로그인/회원가입/로그아웃) API")
@Slf4j
@RestController
@RequestMapping(ApiPath.PATH + "/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;

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

    @Operation(summary = "회원탈퇴", description = "회원탈퇴 처리합니다. 커플 매칭 시 자동 해제됩니다.")
    @DeleteMapping("/withdraw")
    public ApiResponse<Void> withdraw(HttpServletRequest request, HttpServletResponse response) {
        Long userId = (Long) request.getAttribute("userId");
        log.info("[AuthController] 회원탈퇴 요청 - userId: {}", userId);

        authService.withdraw(userId);
        response.addCookie(CookieUtil.createCookie("refresh", null, ExpiredTime.COOKIE_DELETE_AGE));

        return ApiResponse.ok(null);
    }

    // TODO: 운영 환경에서 반드시 제거할 것
    @Operation(summary = "[테스트] userId로 토큰 발급", description = "테스트용 - userId만으로 JWT를 발급합니다.")
    @PostMapping("/test-login/{userId}")
    public ApiResponse<LoginResponse> testLogin(@PathVariable Long userId, HttpServletResponse response) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        String role = user.getRole() != null ? user.getRole().name() : "";
        String accessToken = jwtUtil.createAccessToken(user.getId(), user.getKakaoId(), role);
        String refreshToken = jwtUtil.createRefreshToken(user.getId(), user.getKakaoId(), role);

        response.addCookie(CookieUtil.createCookie("refresh", refreshToken, ExpiredTime.COOKIE_REFRESH_MAX_AGE));

        log.info("[AuthController] 테스트 로그인 - userId: {}", userId);
        return ApiResponse.ok(LoginResponse.of(false, accessToken, refreshToken, user.getNickname(), user.getProfileImage()));
    }
}
