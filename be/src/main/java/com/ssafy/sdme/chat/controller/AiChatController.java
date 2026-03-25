package com.ssafy.sdme.chat.controller;

import com.ssafy.sdme._global.ApiResponse;
import com.ssafy.sdme.chat.dto.AiChatRequest;
import com.ssafy.sdme.chat.dto.AiChatResponse;
import com.ssafy.sdme.chat.dto.AiChatHistoryResponse;
import com.ssafy.sdme.chat.service.AiChatService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
@Tag(name = "AiChat", description = "AI 챗봇 프록시 API")
public class AiChatController {

    private final AiChatService aiChatService;

    @PostMapping("/ai")
    @Operation(summary = "AI 챗봇 메시지 전송", description = "스드메/웨딩홀 추천 AI에 메시지를 보내고 응답을 받습니다")
    public ApiResponse<AiChatResponse> chat(
            @Valid @RequestBody AiChatRequest request,
            @RequestAttribute(value = "userId", required = false) Long userId
    ) {
        log.info("[AiChat] userId: {}, message: {}", userId, request.getMessage());
        AiChatResponse response = aiChatService.chat(request, userId);
        return ApiResponse.ok(response);
    }

    @GetMapping("/ai/history/{sessionId}")
    @Operation(summary = "AI 채팅 히스토리 조회", description = "세션별 AI 대화 내역을 조회합니다")
    public ApiResponse<List<AiChatHistoryResponse>> getHistory(
            @PathVariable String sessionId
    ) {
        List<AiChatHistoryResponse> history = aiChatService.getHistory(sessionId);
        return ApiResponse.ok(history);
    }

    @GetMapping("/ai/sessions")
    @Operation(summary = "AI 채팅 세션 목록", description = "사용자의 AI 채팅 세션 목록을 조회합니다")
    public ApiResponse<List<AiChatHistoryResponse>> getSessions(
            @RequestAttribute(value = "userId", required = false) Long userId
    ) {
        List<AiChatHistoryResponse> sessions = aiChatService.getRecentMessages(userId);
        return ApiResponse.ok(sessions);
    }

    @DeleteMapping("/ai/sessions/{sessionId}")
    @Operation(summary = "AI 채팅 세션 삭제", description = "세션의 모든 메시지를 삭제합니다")
    public ApiResponse<Void> deleteSession(@PathVariable String sessionId) {
        aiChatService.deleteSession(sessionId);
        return ApiResponse.ok(null);
    }
}
