package com.ssafy.sdme.chat.controller;

import com.ssafy.sdme._global.ApiResponse;
import com.ssafy.sdme.chat.dto.AiChatRequest;
import com.ssafy.sdme.chat.dto.AiChatResponse;
import com.ssafy.sdme.chat.service.AiChatService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

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
        log.info("[AiChatController] AI 채팅 요청 - userId: {}", userId);
        if (userId != null) {
            // userId를 request에 주입할 수 없으므로 (immutable) 로깅만
        }
        AiChatResponse response = aiChatService.chat(request);
        return ApiResponse.ok(response);
    }
}
