package com.ssafy.sdme.user.controller;

import com.ssafy.sdme._global.ApiResponse;
import com.ssafy.sdme._global.common.constant.ApiPath;
import com.ssafy.sdme.user.dto.request.UserEditRequest;
import com.ssafy.sdme.user.dto.request.UserPreferenceRequest;
import com.ssafy.sdme.user.dto.response.UserEditResponse;
import com.ssafy.sdme.user.dto.response.UserPreferenceResponse;
import com.ssafy.sdme.user.dto.response.UserResponse;
import com.ssafy.sdme.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

@Tag(name = "User", description = "사용자 관련 API")
@Slf4j
@RestController
@RequestMapping(ApiPath.PATH + "/user")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @Operation(summary = "내 정보 조회", description = "로그인한 사용자의 정보를 조회합니다.")
    @GetMapping("/me")
    public ApiResponse<UserResponse> getMyInfo(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        log.info("[UserController] 내 정보 조회 - userId: {}", userId);
        return ApiResponse.ok(userService.getMyInfo(userId));
    }

    @Operation(summary = "정보 수정", description = "커플 정보를 수정합니다.")
    @PutMapping("/edit")
    public ApiResponse<UserEditResponse> editUser(@Valid @RequestBody UserEditRequest editRequest,
                                                   HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        log.info("[UserController] 정보 수정 - userId: {}", userId);
        return ApiResponse.ok(userService.editUser(userId, editRequest));
    }

    @Operation(summary = "선호도 저장", description = "회원가입 후 선호도 조사 결과를 저장합니다.")
    @PostMapping("/preference")
    public ApiResponse<UserPreferenceResponse> savePreference(@Valid @RequestBody UserPreferenceRequest preferenceRequest,
                                                              HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        log.info("[UserController] 선호도 저장 - userId: {}", userId);
        return ApiResponse.created(userService.savePreference(userId, preferenceRequest));
    }

    @Operation(summary = "선호도 조회", description = "저장된 선호도 정보를 조회합니다.")
    @GetMapping("/preference")
    public ApiResponse<UserPreferenceResponse> getPreference(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        log.info("[UserController] 선호도 조회 - userId: {}", userId);
        return ApiResponse.ok(userService.getPreference(userId));
    }
}
