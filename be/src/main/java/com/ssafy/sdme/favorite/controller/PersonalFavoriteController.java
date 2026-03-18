package com.ssafy.sdme.favorite.controller;

import com.ssafy.sdme._global.ApiResponse;
import com.ssafy.sdme._global.common.constant.ApiPath;
import com.ssafy.sdme.favorite.dto.FavoriteResponse;
import com.ssafy.sdme.favorite.service.FavoriteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "PersonalFavorite", description = "개인 찜 API")
@Slf4j
@RestController
@RequestMapping(ApiPath.PATH + "/personal/favorites")
@RequiredArgsConstructor
public class PersonalFavoriteController {

    private final FavoriteService favoriteService;

    @Operation(summary = "개인 찜목록 조회", description = "내가 찜한 업체 목록을 조회합니다.")
    @GetMapping
    public ApiResponse<List<FavoriteResponse>> getMyFavorites(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        log.info("[PersonalFavoriteController] 찜목록 조회 - userId: {}", userId);
        return ApiResponse.ok(favoriteService.getMyFavorites(userId));
    }

    @Operation(summary = "개인 찜 추가", description = "업체를 찜합니다.")
    @PostMapping("/{vendorId}")
    public ApiResponse<FavoriteResponse> addFavorite(@PathVariable Long vendorId, HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        log.info("[PersonalFavoriteController] 찜 추가 - userId: {}, vendorId: {}", userId, vendorId);
        return ApiResponse.created(favoriteService.addFavorite(userId, vendorId));
    }

    @Operation(summary = "개인 찜 해제", description = "업체 찜을 해제합니다.")
    @DeleteMapping("/{vendorId}")
    public ApiResponse<Void> removeFavorite(@PathVariable Long vendorId, HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        log.info("[PersonalFavoriteController] 찜 해제 - userId: {}, vendorId: {}", userId, vendorId);
        favoriteService.removeFavorite(userId, vendorId);
        return ApiResponse.ok(null);
    }
}
