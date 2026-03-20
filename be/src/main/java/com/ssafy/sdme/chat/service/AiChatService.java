package com.ssafy.sdme.chat.service;

import com.ssafy.sdme.chat.dto.AiChatRequest;
import com.ssafy.sdme.chat.dto.AiChatResponse;
import com.ssafy.sdme.chat.dto.AiRecommendation;
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

    public AiChatService(
            RestTemplate restTemplate,
            @Value("${ai.server-url:http://localhost:8000}") String aiServerUrl,
            VendorRepository vendorRepository
    ) {
        this.restTemplate = restTemplate;
        this.aiServerUrl = aiServerUrl;
        this.vendorRepository = vendorRepository;
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

        // AI recommendations → MySQL 상세 조회
        List<AiRecommendation> recommendations = enrichRecommendations(
                (List<Map<String, Object>>) data.getOrDefault("recommendations", Collections.emptyList())
        );

        return AiChatResponse.of(answer, returnedSessionId, recommendations);
    }

    private List<AiRecommendation> enrichRecommendations(List<Map<String, Object>> aiRecs) {
        if (aiRecs == null || aiRecs.isEmpty()) {
            return Collections.emptyList();
        }

        // AI가 보낸 ID 수집
        List<Long> sourceIds = new ArrayList<>();
        Map<String, Map<String, Object>> recMap = new LinkedHashMap<>();
        for (Map<String, Object> rec : aiRecs) {
            String id = String.valueOf(rec.getOrDefault("id", ""));
            recMap.put(id, rec);
            try {
                sourceIds.add(Long.parseLong(id));
            } catch (NumberFormatException e) {
                // ID가 숫자가 아닌 경우 (이름으로 된 경우)
            }
        }

        // MySQL에서 상세 조회
        Map<Long, Vendor> vendorMap = new HashMap<>();
        if (!sourceIds.isEmpty()) {
            List<Vendor> vendors = vendorRepository.findBySourceIdIn(sourceIds);
            for (Vendor v : vendors) {
                vendorMap.put(v.getSourceId(), v);
            }
        }

        // 결합: AI 추천 사유 + MySQL 상세 데이터
        List<AiRecommendation> enriched = new ArrayList<>();
        for (Map.Entry<String, Map<String, Object>> entry : recMap.entrySet()) {
            Map<String, Object> rec = entry.getValue();
            String title = (String) rec.getOrDefault("title", "");
            String reason = (String) rec.get("reason");
            String source = (String) rec.getOrDefault("source", "sdm");
            String category = (String) rec.getOrDefault("category", "studio");

            Long sourceId = null;
            try {
                sourceId = Long.parseLong(entry.getKey());
            } catch (NumberFormatException e) {
                // ignore
            }

            Vendor vendor = sourceId != null ? vendorMap.get(sourceId) : null;

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
                        .build());
            } else {
                // MySQL에 없는 경우 (웨딩홀 등) — AI 데이터만으로 구성
                enriched.add(AiRecommendation.builder()
                        .id(sourceId)
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
