package com.ssafy.sdme.chat.controller;

import com.ssafy.sdme._global.ApiResponse;
import com.ssafy.sdme._global.common.constant.ApiPath;
import com.ssafy.sdme.chat.dto.ChatMessageRequest;
import com.ssafy.sdme.chat.dto.ChatMessageResponse;
import com.ssafy.sdme.chat.service.CoupleChatService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "CoupleChat", description = "커플 채팅 API")
@Slf4j
@RestController
@RequestMapping(ApiPath.PATH + "/chat")
@RequiredArgsConstructor
public class  CoupleChatController {

    private final CoupleChatService chatService;
    private final SimpMessagingTemplate messagingTemplate;

    // WebSocket: 클라이언트 → /app/chat.send → 저장 후 → /topic/couple/{coupleId}로 브로드캐스트
    @MessageMapping("/chat.send")
    public void sendMessage(ChatMessageRequest request) {
        ChatMessageResponse response = chatService.saveAndCreateResponse(request);
        messagingTemplate.convertAndSend("/topic/couple/" + request.getCoupleId(), response);
    }

    // REST: 채팅 히스토리 조회
    @Operation(summary = "커플 채팅 히스토리 조회", description = "커플 채팅 메시지 목록을 조회합니다.")
    @GetMapping("/couple/messages")
    public ApiResponse<List<ChatMessageResponse>> getMessages(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        log.info("[CoupleChatController] 채팅 히스토리 조회 - userId: {}", userId);
        return ApiResponse.ok(chatService.getMessages(userId));
    }
}
