package com.ssafy.sdme.chat.controller;

import com.ssafy.sdme._global.ApiResponse;
import com.ssafy.sdme._global.common.constant.ApiPath;
import com.ssafy.sdme.chat.dto.*;
import com.ssafy.sdme.chat.service.AiChatService;
import com.ssafy.sdme.chat.service.CoupleChatService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@Tag(name = "CoupleChat", description = "커플 채팅 API")
@Slf4j
@RestController
@RequestMapping(ApiPath.PATH + "/chat")
@RequiredArgsConstructor
public class  CoupleChatController {

    private final CoupleChatService chatService;
    private final AiChatService aiChatService;
    private final SimpMessagingTemplate messagingTemplate;

    // WebSocket: 클라이언트 → /app/chat.send → 저장 후 → /topic/couple/{coupleId}로 브로드캐스트
    @MessageMapping("/chat.send")
    public void sendMessage(ChatMessageRequest request) {
        ChatMessageResponse response = chatService.saveAndCreateResponse(request);
        messagingTemplate.convertAndSend("/topic/couple/" + request.getCoupleId(), response);
    }

    // WebSocket: DB 저장 없이 브로드캐스트만 (삭제 신호 등)
    @MessageMapping("/chat.notify")
    public void notify(ChatMessageRequest request) {
        String payload = "{\"type\":\"vendor_unshare\",\"vendorId\":\"" + request.getVendorId() + "\",\"senderId\":" + request.getSenderId() + "}";
        messagingTemplate.convertAndSend("/topic/couple/" + request.getCoupleId(), payload);
    }

    // REST: 채팅 메시지 전송 (MCP 등 외부에서 사용)
    @Operation(summary = "채팅 메시지 전송", description = "REST API로 커플 채팅 메시지를 전송합니다.")
    @PostMapping("/couple/messages")
    public ApiResponse<ChatMessageResponse> sendMessageRest(@RequestBody ChatMessageRequest request,
                                                             HttpServletRequest httpRequest) {
        Long userId = (Long) httpRequest.getAttribute("userId");
        ChatMessageResponse response = chatService.saveAndCreateResponse(request);
        messagingTemplate.convertAndSend("/topic/couple/" + request.getCoupleId(), response);
        log.info("[CoupleChatController] REST 채팅 전송 - userId: {}, type: {}", userId, request.getMessageType());
        return ApiResponse.ok(response);
    }

    // REST: 이미지 업로드
    @Operation(summary = "채팅 이미지 전송", description = "커플 채팅에 이미지를 업로드합니다.")
    @PostMapping("/couple/images")
    public ApiResponse<ChatMessageResponse> uploadImage(@RequestParam("file") MultipartFile file,
                                                         @RequestParam("coupleId") Long coupleId,
                                                         HttpServletRequest httpRequest) {
        Long userId = (Long) httpRequest.getAttribute("userId");
        ChatMessageResponse response = chatService.saveImageMessage(userId, coupleId, file);
        messagingTemplate.convertAndSend("/topic/couple/" + coupleId, response);
        log.info("[CoupleChatController] 이미지 전송 - userId: {}, coupleId: {}", userId, coupleId);
        return ApiResponse.ok(response);
    }

    // REST: 채팅 히스토리 조회
    @Operation(summary = "커플 채팅 히스토리 조회", description = "커플 채팅 메시지 목록을 조회합니다.")
    @GetMapping("/couple/messages")
    public ApiResponse<List<ChatMessageResponse>> getMessages(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        log.info("[CoupleChatController] 채팅 히스토리 조회 - userId: {}", userId);
        return ApiResponse.ok(chatService.getMessages(userId));
    }

    // ── 커플 AI 세션 관리 ──

    @Operation(summary = "AI 세션 선택", description = "커플 채팅에 사용할 AI 세션을 선택합니다.")
    @PutMapping("/couple/ai-sessions")
    public ApiResponse<Void> selectAiSession(@RequestBody Map<String, String> body,
                                              HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        String sessionId = body.get("sessionId");
        chatService.selectAiSession(userId, sessionId);
        log.info("[CoupleChatController] AI 세션 선택 - userId: {}, sessionId: {}", userId, sessionId);
        return ApiResponse.ok(null);
    }

    @Operation(summary = "AI 세션 해제", description = "커플 채팅에서 AI 세션을 해제합니다.")
    @DeleteMapping("/couple/ai-sessions")
    public ApiResponse<Void> clearAiSession(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        chatService.clearAiSession(userId);
        log.info("[CoupleChatController] AI 세션 해제 - userId: {}", userId);
        return ApiResponse.ok(null);
    }

    @Operation(summary = "선택된 AI 세션 조회", description = "커플의 선택된 AI 세션 정보를 조회합니다.")
    @GetMapping("/couple/ai-sessions")
    public ApiResponse<CoupleAiSessionResponse> getSelectedSessions(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        log.info("[CoupleChatController] AI 세션 조회 - userId: {}", userId);
        return ApiResponse.ok(chatService.getSelectedSessions(userId));
    }

    // ── 커플 AI 채팅 ──

    @Operation(summary = "커플 AI 채팅", description = "커플 컨텍스트를 포함한 AI 채팅 메시지를 전송합니다.")
    @PostMapping("/couple/ai")
    public ApiResponse<AiChatResponse> coupleAiChat(@Valid @RequestBody CoupleAiChatRequest request,
                                                     HttpServletRequest httpRequest) {
        Long userId = (Long) httpRequest.getAttribute("userId");
        log.info("[CoupleChatController] 커플 AI 채팅 - userId: {}, message: {}", userId, request.getMessage());
        AiChatResponse response = aiChatService.coupleChat(request, userId);
        return ApiResponse.ok(response);
    }
}
