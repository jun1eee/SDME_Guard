package com.ssafy.sdme.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class AiChatResponse {
    private String answer;
    private String sessionId;
    private boolean success;

    public static AiChatResponse of(String answer, String sessionId) {
        return new AiChatResponse(answer, sessionId, true);
    }

    public static AiChatResponse error(String message) {
        return new AiChatResponse(message, null, false);
    }
}
