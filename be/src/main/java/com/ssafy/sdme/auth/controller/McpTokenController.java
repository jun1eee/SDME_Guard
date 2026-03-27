package com.ssafy.sdme.auth.controller;

import com.ssafy.sdme._global.ApiResponse;
import com.ssafy.sdme._global.common.constant.ApiPath;
import com.ssafy.sdme.auth.domain.McpToken;
import com.ssafy.sdme.auth.dto.response.LoginResponse;
import com.ssafy.sdme.auth.jwt.JwtUtil;
import com.ssafy.sdme.auth.repository.McpTokenRepository;
import com.ssafy.sdme.user.domain.User;
import com.ssafy.sdme.user.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Tag(name = "McpToken", description = "MCP 연동 토큰 API")
@Slf4j
@RestController
@RequestMapping(ApiPath.PATH + "/mcp")
@RequiredArgsConstructor
public class McpTokenController {

    private final McpTokenRepository mcpTokenRepository;
    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;

    @Operation(summary = "MCP 토큰 발급/조회", description = "로그인한 유저의 MCP 토큰을 발급하거나 기존 토큰을 조회합니다.")
    @PostMapping("/token")
    @Transactional
    public ApiResponse<Map<String, String>> getOrCreateToken(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        McpToken token = mcpTokenRepository.findFirstByUserId(userId)
                .orElseGet(() -> mcpTokenRepository.save(new McpToken(userId)));

        log.info("[MCP] 토큰 조회/발급 - userId: {}", userId);
        return ApiResponse.ok(Map.of("token", token.getToken()));
    }

    @Operation(summary = "MCP 토큰 재발급", description = "기존 토큰을 삭제하고 새 토큰을 발급합니다.")
    @PostMapping("/token/refresh")
    @Transactional
    public ApiResponse<Map<String, String>> refreshToken(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        mcpTokenRepository.deleteByUserId(userId);
        McpToken token = mcpTokenRepository.save(new McpToken(userId));

        log.info("[MCP] 토큰 재발급 - userId: {}", userId);
        return ApiResponse.ok(Map.of("token", token.getToken()));
    }

    @Operation(summary = "MCP 토큰으로 인증", description = "MCP 토큰으로 JWT를 발급받습니다. (인증 불필요)")
    @PostMapping("/auth")
    public ApiResponse<LoginResponse> authByToken(@RequestBody Map<String, String> body) {
        String token = body.get("token");
        McpToken mcpToken = mcpTokenRepository.findByToken(token)
                .orElseThrow(() -> new RuntimeException("유효하지 않은 MCP 토큰입니다."));

        User user = userRepository.findById(mcpToken.getUserId())
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        String role = user.getRole() != null ? user.getRole().name() : "";
        String accessToken = jwtUtil.createAccessToken(user.getId(), user.getKakaoId(), role);

        log.info("[MCP] 토큰 인증 - userId: {}", user.getId());
        return ApiResponse.ok(LoginResponse.of(false, accessToken, null, user.getNickname(), user.getProfileImage()));
    }
}
