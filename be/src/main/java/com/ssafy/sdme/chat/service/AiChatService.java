package com.ssafy.sdme.chat.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.sdme.chat.domain.AiChatMessage;
import com.ssafy.sdme.chat.dto.AiChatHistoryResponse;
import com.ssafy.sdme.chat.dto.AiChatRequest;
import com.ssafy.sdme.chat.dto.AiChatResponse;
import com.ssafy.sdme.chat.dto.AiRecommendation;
import com.ssafy.sdme.chat.repository.AiChatMessageRepository;
import com.ssafy.sdme.couple.domain.Couple;
import com.ssafy.sdme.couple.repository.CoupleRepository;
import com.ssafy.sdme.vendor.application.VendorIdConverter;
import com.ssafy.sdme.vendor.domain.Vendor;
import com.ssafy.sdme.vendor.repository.VendorRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class AiChatService {

    private final RestTemplate restTemplate;
    private final String aiServerUrl;
    private final VendorRepository vendorRepository;
    private final VendorIdConverter idConverter;
    private final AiChatMessageRepository aiChatMessageRepository;
    private final CoupleRepository coupleRepository;
    private final ObjectMapper objectMapper;

    public AiChatService(
            RestTemplate restTemplate,
            @Value("${ai.server-url:http://localhost:8000}") String aiServerUrl,
            VendorRepository vendorRepository,
            VendorIdConverter idConverter,
            AiChatMessageRepository aiChatMessageRepository,
            CoupleRepository coupleRepository,
            ObjectMapper objectMapper
    ) {
        this.restTemplate = restTemplate;
        this.aiServerUrl = aiServerUrl;
        this.vendorRepository = vendorRepository;
        this.idConverter = idConverter;
        this.aiChatMessageRepository = aiChatMessageRepository;
        this.coupleRepository = coupleRepository;
        this.objectMapper = objectMapper;
    }

    public AiChatResponse chat(AiChatRequest request, Long userId) {
        log.info("[AiChat] AI 요청 - sessionId: {}, message: {}", request.getSessionId(), request.getMessage());

        Long coupleId = resolveCoupleId(userId);

        try {
            Map<String, Object> body = buildRequestBody(request, userId);

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

            AiChatResponse chatResponse = parseResponse(response.getBody(), request.getSessionId());

            // 메시지 영속화
            if (chatResponse.isSuccess() && chatResponse.getSessionId() != null) {
                saveMessages(coupleId, userId, chatResponse.getSessionId(),
                        request.getMessage(), chatResponse);
            }

            return chatResponse;
        } catch (RestClientException e) {
            log.error("[AiChat] AI 서버 연결 실패", e);
            return AiChatResponse.error("AI 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
        } catch (Exception e) {
            log.error("[AiChat] 처리 중 오류", e);
            return AiChatResponse.error("AI 서버 오류가 발생했습니다.");
        }
    }

    public List<AiChatHistoryResponse> getHistory(String sessionId) {
        return aiChatMessageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId)
                .stream()
                .map(AiChatHistoryResponse::from)
                .collect(Collectors.toList());
    }

    public List<AiChatHistoryResponse> getRecentMessages(Long userId) {
        Long coupleId = resolveCoupleId(userId);
        if (coupleId == null) return Collections.emptyList();

        return aiChatMessageRepository.findTop50ByCoupleIdOrderByCreatedAtDesc(coupleId)
                .stream()
                .map(AiChatHistoryResponse::from)
                .collect(Collectors.toList());
    }

    // ── 내부 메서드 ──

    private void saveMessages(Long coupleId, Long userId, String sessionId,
                              String userMessage, AiChatResponse response) {
        if (coupleId == null) {
            log.warn("[AiChat] coupleId가 null이므로 메시지 저장 skip (userId={})", userId);
            return;
        }
        try {
            aiChatMessageRepository.save(AiChatMessage.builder()
                    .coupleId(coupleId)
                    .userId(userId)
                    .sessionId(sessionId)
                    .role("user")
                    .content(userMessage)
                    .build());

            String recsJson = null;
            if (response.getRecommendations() != null && !response.getRecommendations().isEmpty()) {
                try {
                    recsJson = objectMapper.writeValueAsString(response.getRecommendations());
                } catch (JsonProcessingException e) {
                    log.warn("[AiChat] recommendations JSON 변환 실패", e);
                }
            }

            aiChatMessageRepository.save(AiChatMessage.builder()
                    .coupleId(coupleId)
                    .userId(userId)
                    .sessionId(sessionId)
                    .role("assistant")
                    .content(response.getAnswer())
                    .recommendations(recsJson)
                    .build());
            log.info("[AiChat] 메시지 저장 완료 - coupleId: {}, sessionId: {}", coupleId, sessionId);
        } catch (Exception e) {
            log.error("[AiChat] 메시지 저장 실패 (채팅은 정상 진행)", e);
        }
    }

    private Long resolveCoupleId(Long userId) {
        if (userId == null) return null;
        try {
            return coupleRepository.findByGroomIdOrBrideId(userId, userId)
                    .map(Couple::getId)
                    .orElse(null);
        } catch (Exception e) {
            log.warn("[AiChat] coupleId 조회 실패: userId={}", userId);
            return null;
        }
    }

    private Map<String, Object> buildRequestBody(AiChatRequest request, Long userId) {
        Map<String, Object> body = new HashMap<>();
        body.put("message", request.getMessage());
        if (request.getSessionId() != null) {
            body.put("session_id", request.getSessionId());
        }
        if (userId != null) {
            body.put("context", Map.of("user_id", userId));
        } else if (request.getUserId() != null) {
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

        List<AiRecommendation> recommendations = enrichRecommendations(
                (List<Map<String, Object>>) data.getOrDefault("recommendations", Collections.emptyList())
        );

        return AiChatResponse.of(answer, returnedSessionId, recommendations);
    }

    private List<AiRecommendation> enrichRecommendations(List<Map<String, Object>> aiRecs) {
        if (aiRecs == null || aiRecs.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> sourceIds = new ArrayList<>();
        Map<String, Map<String, Object>> recMap = new LinkedHashMap<>();
        for (Map<String, Object> rec : aiRecs) {
            String id = String.valueOf(rec.getOrDefault("id", ""));
            String category = (String) rec.getOrDefault("category", "studio");
            recMap.put(id, rec);
            try {
                long partnerId = Long.parseLong(id);
                sourceIds.add(idConverter.toSourceId(partnerId, category));
            } catch (NumberFormatException e) {
                // ID가 숫자가 아닌 경우
            }
        }

        Map<Long, Vendor> vendorMap = new HashMap<>();
        if (!sourceIds.isEmpty()) {
            List<Vendor> vendors = vendorRepository.findBySourceIdIn(sourceIds);
            for (Vendor v : vendors) {
                vendorMap.put(v.getSourceId(), v);
            }
        }

        List<AiRecommendation> enriched = new ArrayList<>();
        for (Map.Entry<String, Map<String, Object>> entry : recMap.entrySet()) {
            Map<String, Object> rec = entry.getValue();
            String title = (String) rec.getOrDefault("title", "");
            String reason = (String) rec.get("reason");
            String source = (String) rec.getOrDefault("source", "sdm");
            String category = (String) rec.getOrDefault("category", "studio");

            Long mysqlSourceId = null;
            try {
                long partnerId = Long.parseLong(entry.getKey());
                mysqlSourceId = idConverter.toSourceId(partnerId, category);
            } catch (NumberFormatException e) {
                // ignore
            }

            Vendor vendor = mysqlSourceId != null ? vendorMap.get(mysqlSourceId) : null;

            if (vendor != null) {
                enriched.add(AiRecommendation.builder()
                        .id(vendor.getSourceId())
                        .source(source)
                        .category(vendor.getCategory())
                        .name(vendor.getName())
                        .reason(reason)
                        .rating(vendor.getRating())
                        .reviewCount(vendor.getReviewCount())
                        .price(vendor.getPrice())
                        .imageUrl(vendor.getImageUrl())
                        .contact(vendor.getContact())
                        .description(vendor.getDescription())
                        .hashtags(vendor.getHashtags())
                        .build());
            } else {
                enriched.add(AiRecommendation.builder()
                        .id(mysqlSourceId)
                        .source(source)
                        .category(category)
                        .name(title)
                        .reason(reason)
                        .build());
            }
        }

        return enriched;
    }
}
