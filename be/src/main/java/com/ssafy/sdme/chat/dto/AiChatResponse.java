package com.ssafy.sdme.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Collections;
import java.util.List;

@Getter
@AllArgsConstructor
public class AiChatResponse {
    private String answer;
    private String sessionId;
    private boolean success;
    private List<AiRecommendation> recommendations;

    public static AiChatResponse of(String answer, String sessionId, List<AiRecommendation> recommendations) {
        return new AiChatResponse(answer, sessionId, true, recommendations);
    }

    public static AiChatResponse of(String answer, String sessionId) {
        return new AiChatResponse(answer, sessionId, true, Collections.emptyList());
    }

    public static AiChatResponse error(String message) {
        return new AiChatResponse(message, null, false, Collections.emptyList());
    }
}
