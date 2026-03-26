package com.ssafy.sdme.user.controller;

import com.ssafy.sdme._global.ApiResponse;
import com.ssafy.sdme._global.common.constant.ApiPath;
import com.ssafy.sdme.user.dto.request.UserEditRequest;
import com.ssafy.sdme.user.dto.request.UserPreferenceRequest;
import com.ssafy.sdme.user.dto.request.UserSharedInfoRequest;
import com.ssafy.sdme.user.dto.request.UserTastesRequest;
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
import org.springframework.web.multipart.MultipartFile;

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

    @Operation(summary = "내 정보 수정", description = "커플 정보를 수정합니다.")
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

    @Operation(summary = "취향 수정", description = "웨딩 스타일/컬러/분위기/식사 취향을 수정합니다.")
    @PutMapping("/preference/tastes")
    public ApiResponse<UserPreferenceResponse> updateTastes(@RequestBody UserTastesRequest tastesRequest,
                                                            HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        log.info("[UserController] 취향 수정 - userId: {}", userId);
        return ApiResponse.ok(userService.updateTastes(userId, tastesRequest));
    }

    @Operation(summary = "추가 정보 수정 (커플 동기화)", description = "결혼 예정일, 예산, 하객수를 수정합니다. 커플 매칭 시 파트너에게도 동기화됩니다.")
    @PutMapping("/preference/shared-info")
    public ApiResponse<UserPreferenceResponse> updateSharedInfo(@RequestBody UserSharedInfoRequest infoRequest,
                                                                 HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        log.info("[UserController] 추가 정보 수정 - userId: {}", userId);
        return ApiResponse.ok(userService.updateSharedInfo(userId, infoRequest));
    }

    @Operation(summary = "프로필 이미지 업로드", description = "프로필 이미지를 업로드하고 URL을 반환합니다.")
    @PostMapping(value = "/me/profile-image", consumes = "multipart/form-data")
    public ApiResponse<String> uploadProfileImage(@RequestParam("file") MultipartFile file,
                                                   HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        log.info("[UserController] 프로필 이미지 업로드 - userId: {}", userId);
        String imageUrl = userService.updateProfileImage(userId, file);
        return ApiResponse.ok(imageUrl);
    }
}
