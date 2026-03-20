package com.ssafy.sdme.favorite.controller;

import com.ssafy.sdme._global.ApiResponse;
import com.ssafy.sdme._global.common.constant.ApiPath;
import com.ssafy.sdme.favorite.service.FavoriteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.sdme.favorite.dto.FavoriteResponse;
import java.util.List;

@Tag(name = "CoupleFavorite", description = "커플 찜목록 API")
@Slf4j
@RestController
@RequestMapping(ApiPath.PATH + "/couple/favorites")
@RequiredArgsConstructor
public class CoupleFavoriteController {

    private final FavoriteService favoriteService;

    @Operation(summary = "커플 전체 찜 조회", description = "신랑/신부 각각 찜한 업체 전체 목록을 조회합니다.")
    @GetMapping("/all")
    public ApiResponse<List<FavoriteResponse>> getAllCoupleFavorites(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        return ApiResponse.ok(favoriteService.getAllCoupleFavorites(userId));
    }

    @Operation(summary = "커플 공통 찜목록 조회", description = "신랑/신부 둘 다 찜한 업체 목록을 조회합니다.")
    @GetMapping
    public ApiResponse<List<FavoriteResponse>> getCoupleFavorites(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        log.info("[CoupleFavoriteController] 커플 찜목록 조회 - userId: {}", userId);
        return ApiResponse.ok(favoriteService.getCoupleFavorites(userId));
    }
}
