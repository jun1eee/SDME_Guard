package com.ssafy.sdme.chat.service;

import com.ssafy.sdme.chat.dto.AiChatRequest;
import com.ssafy.sdme.chat.dto.AiChatResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
public class AiChatService {

    private final RestTemplate restTemplate;
    private final String aiServerUrl;

    public AiChatService(
            RestTemplate restTemplate,
            @Value("${ai.server-url:http://localhost:8000}") String aiServerUrl
    ) {
        this.restTemplate = restTemplate;
        this.aiServerUrl = aiServerUrl;
    }

    public AiChatResponse chat(AiChatRequest request) {
        log.info("[AiChat] AI 요청 - sessionId: {}, message: {}", request.getSessionId(), request.getMessage());

        try {
            Map<String, Object> body = buildRequestBody(request);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

            @SuppressWarnings("unchecked")
            ResponseEntity<Map> response = restTemplate.exchange(
                    aiServerUrl + "/api/chat/sdm",
                    HttpMethod.POST,
                    entity,
                    Map.class
            );

            return parseResponse(response.getBody(), request.getSessionId());
        } catch (RestClientException e) {
            log.error("[AiChat] AI 서버 연결 실패", e);
            return AiChatResponse.error("AI 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
        } catch (Exception e) {
            log.error("[AiChat] 처리 중 오류", e);
            return AiChatResponse.error("AI 서버 오류가 발생했습니다.");
        }
    }

    private Map<String, Object> buildRequestBody(AiChatRequest request) {
        Map<String, Object> body = new HashMap<>();
        body.put("message", request.getMessage());

        if (request.getSessionId() != null) {
            body.put("session_id", request.getSessionId());
        }

        if (request.getUserId() != null) {
            body.put("context", Map.of("user_id", request.getUserId()));
        }

        return body;
    }

    @SuppressWarnings("unchecked")
    private AiChatResponse parseResponse(Map<String, Object> result, String sessionId) {
        if (result == null || !Boolean.TRUE.equals(result.get("success"))) {
            return AiChatResponse.error("AI 응답을 처리할 수 없습니다.");
        }

        Map<String, Object> data = (Map<String, Object>) result.get("data");
        if (data == null) {
            return AiChatResponse.error("AI 응답 데이터가 없습니다.");
        }

        String answer = (String) data.getOrDefault("answer", "");
        String returnedSessionId = (String) data.getOrDefault("session_id", sessionId);

        return AiChatResponse.of(answer, returnedSessionId);
    }
}
