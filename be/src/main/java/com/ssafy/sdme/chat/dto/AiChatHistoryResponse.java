package com.ssafy.sdme.chat.dto;

import com.ssafy.sdme.chat.domain.AiChatMessage;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class AiChatHistoryResponse {
    private Long id;
    private String sessionId;
    private String role;
    private String content;
    private String recommendations;
    private LocalDateTime createdAt;

    public static AiChatHistoryResponse from(AiChatMessage message) {
        return new AiChatHistoryResponse(
                message.getId(),
                message.getSessionId(),
                message.getRole(),
                message.getContent(),
                message.getRecommendations(),
                message.getCreatedAt()
        );
    }
}
