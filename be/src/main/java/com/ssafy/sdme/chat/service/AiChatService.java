package com.ssafy.sdme.chat.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.sdme.chat.domain.AiChatMessage;
import com.ssafy.sdme.chat.domain.CoupleChatRoom;
import com.ssafy.sdme.chat.dto.*;
import com.ssafy.sdme.chat.repository.AiChatMessageRepository;
import com.ssafy.sdme.chat.repository.CoupleChatRoomRepository;
import com.ssafy.sdme.couple.domain.Couple;
import com.ssafy.sdme.couple.repository.CoupleRepository;
import com.ssafy.sdme.user.domain.UserPreference;
import com.ssafy.sdme.user.repository.UserPreferenceRepository;
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
import java.util.regex.Pattern;
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
    private final CoupleChatRoomRepository coupleChatRoomRepository;
    private final UserPreferenceRepository userPreferenceRepository;
    private final ObjectMapper objectMapper;

    public AiChatService(
            RestTemplate restTemplate,
            @Value("${ai.server-url:http://localhost:8000}") String aiServerUrl,
            VendorRepository vendorRepository,
            VendorIdConverter idConverter,
            AiChatMessageRepository aiChatMessageRepository,
            CoupleRepository coupleRepository,
            CoupleChatRoomRepository coupleChatRoomRepository,
            UserPreferenceRepository userPreferenceRepository,
            ObjectMapper objectMapper
    ) {
        this.restTemplate = restTemplate;
        this.aiServerUrl = aiServerUrl;
        this.vendorRepository = vendorRepository;
        this.idConverter = idConverter;
        this.aiChatMessageRepository = aiChatMessageRepository;
        this.coupleRepository = coupleRepository;
        this.coupleChatRoomRepository = coupleChatRoomRepository;
        this.userPreferenceRepository = userPreferenceRepository;
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

            String endpoint = resolveAiEndpoint(request.getMessage());
            log.info("[AiChat] 라우팅: {} → {}", request.getMessage().substring(0, Math.min(30, request.getMessage().length())), endpoint);

            @SuppressWarnings("unchecked")
            ResponseEntity<Map> response = restTemplate.exchange(
                    endpoint,
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
        if (userId == null) return Collections.emptyList();

        // AI 채팅은 개인 채팅이므로 userId로만 조회 (coupleId 사용 시 상대방 채팅이 섞임)
        List<AiChatMessage> messages = aiChatMessageRepository.findTop50ByUserIdOrderByCreatedAtDesc(userId);

        return messages.stream()
                .map(AiChatHistoryResponse::from)
                .collect(Collectors.toList());
    }

    @SuppressWarnings("unchecked")
    public AiChatResponse coupleChat(CoupleAiChatRequest request, Long userId) {
        log.info("[AiChat] 커플 AI 요청 - sessionId: {}, message: {}", request.getSessionId(), request.getMessage());

        Long coupleId = resolveCoupleId(userId);

        try {
            // 기본 요청 바디 구성
            Map<String, Object> body = new HashMap<>();
            body.put("message", request.getMessage());
            if (request.getSessionId() != null) {
                body.put("session_id", request.getSessionId());
            }

            Map<String, Object> context = new HashMap<>();
            context.put("user_id", userId);
            if (coupleId != null) {
                context.put("couple_id", coupleId);
            }
            body.put("context", context);

            // 커플 컨텍스트 구성
            if (coupleId != null) {
                Couple couple = coupleRepository.findByGroomIdOrBrideId(userId, userId).orElse(null);
                if (couple != null) {
                    CoupleChatRoom room = coupleChatRoomRepository.findByCoupleId(couple.getId()).orElse(null);
                    if (room != null) {
                        Map<String, Object> coupleContext = new HashMap<>();
                        String groomSessionId = room.getGroomAiSessionId();
                        String brideSessionId = room.getBrideAiSessionId();

                        if (groomSessionId != null) {
                            coupleContext.put("groom_summary", buildSessionSummary(groomSessionId));
                        }
                        if (brideSessionId != null) {
                            coupleContext.put("bride_summary", buildSessionSummary(brideSessionId));
                        }
                        body.put("couple_context", coupleContext);
                    }

                    // 양쪽 취향 데이터 포함
                    Map<String, Object> prefs = buildCouplePreferences(coupleId, userId);
                    if (!prefs.isEmpty()) {
                        context.put("preferences", prefs);
                    }
                }
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

            String endpoint = resolveAiEndpoint(request.getMessage());
            log.info("[AiChat] 커플 라우팅: {} → {}", request.getMessage().substring(0, Math.min(30, request.getMessage().length())), endpoint);

            ResponseEntity<Map> response = restTemplate.exchange(
                    endpoint,
                    HttpMethod.POST,
                    entity,
                    Map.class
            );

            AiChatResponse chatResponse = parseResponse(response.getBody(), request.getSessionId());

            // 커플 AI 채팅은 개인 MY CHATS에 노출되지 않도록 저장하지 않음
            return chatResponse;
        } catch (RestClientException e) {
            log.error("[AiChat] AI 서버 연결 실패", e);
            return AiChatResponse.error("AI 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
        } catch (Exception e) {
            log.error("[AiChat] 처리 중 오류", e);
            return AiChatResponse.error("AI 서버 오류가 발생했습니다.");
        }
    }

    public String buildSessionSummary(String sessionId) {
        List<AiChatMessage> messages = aiChatMessageRepository.findTop20BySessionIdOrderByCreatedAtDesc(sessionId);
        // 역순으로 정렬하여 시간순으로 변경
        Collections.reverse(messages);

        StringBuilder summary = new StringBuilder();
        for (AiChatMessage msg : messages) {
            if ("user".equals(msg.getRole())) {
                String content = msg.getContent();
                if (content != null && content.length() > 100) {
                    content = content.substring(0, 100);
                }
                summary.append("- 질문: ").append(content).append("\n");
            } else if ("assistant".equals(msg.getRole())) {
                // 추천 업체 목록 (recommendations JSON)
                if (msg.getRecommendations() != null) {
                    try {
                        List<Map<String, Object>> recs = objectMapper.readValue(
                                msg.getRecommendations(),
                                objectMapper.getTypeFactory().constructCollectionType(List.class, Map.class)
                        );
                        List<String> names = recs.stream()
                                .map(r -> (String) r.getOrDefault("name", ""))
                                .filter(n -> !n.isEmpty())
                                .collect(Collectors.toList());
                        if (!names.isEmpty()) {
                            summary.append("- 추천 업체: ").append(String.join(", ", names)).append("\n");
                        }
                    } catch (Exception e) {
                        log.warn("[AiChat] recommendations 파싱 실패", e);
                    }
                }
                // 답변 텍스트 요약 (추천 업체가 없는 상세/비교 답변 포함)
                String aiContent = msg.getContent();
                if (aiContent != null && !aiContent.isEmpty()) {
                    String snippet = aiContent.length() > 150 ? aiContent.substring(0, 150) : aiContent;
                    summary.append("- 답변: ").append(snippet).append("\n");
                }
            }
        }

        String result = summary.toString();
        if (result.length() > 1500) {
            result = result.substring(0, 1500);
        }
        return result;
    }

    @org.springframework.transaction.annotation.Transactional
    public void deleteSession(String sessionId) {
        aiChatMessageRepository.deleteBySessionId(sessionId);
        log.info("[AiChat] 세션 삭제 완료 - sessionId: {}", sessionId);
    }

    // ── 내부 메서드 ──

    private void saveMessages(Long coupleId, Long userId, String sessionId,
                              String userMessage, AiChatResponse response) {
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

    private Map<String, Object> buildCouplePreferences(Long coupleId, Long currentUserId) {
        Map<String, Object> result = new HashMap<>();
        try {
            Couple couple = coupleRepository.findById(coupleId).orElse(null);
            if (couple == null) return result;

            boolean isGroom = currentUserId.equals(couple.getGroomId());
            Long myId = isGroom ? couple.getGroomId() : couple.getBrideId();
            Long partnerId = isGroom ? couple.getBrideId() : couple.getGroomId();

            if (myId != null) {
                Map<String, Object> myPrefs = buildPreferenceMap(myId);
                if (!myPrefs.isEmpty()) {
                    result.put(isGroom ? "groom" : "bride", myPrefs);
                }
            }
            if (partnerId != null) {
                Map<String, Object> partnerPrefs = buildPreferenceMap(partnerId);
                if (!partnerPrefs.isEmpty()) {
                    result.put(isGroom ? "bride" : "groom", partnerPrefs);
                }
            }
        } catch (Exception e) {
            log.warn("[AiChat] 커플 취향 조회 실패: coupleId={}", coupleId);
        }
        return result;
    }

    private Map<String, Object> buildPreferenceMap(Long userId) {
        Map<String, Object> prefs = new HashMap<>();
        UserPreference pref = userPreferenceRepository.findByUserId(userId).orElse(null);
        if (pref == null) return prefs;

        if (pref.getStyles() != null && !pref.getStyles().isEmpty()) prefs.put("styles", pref.getStyles());
        if (pref.getColors() != null && !pref.getColors().isEmpty()) prefs.put("colors", pref.getColors());
        if (pref.getMoods() != null && !pref.getMoods().isEmpty()) prefs.put("moods", pref.getMoods());
        if (pref.getFoods() != null && !pref.getFoods().isEmpty()) prefs.put("foods", pref.getFoods());
        if (pref.getHallStyle() != null) prefs.put("hall_style", pref.getHallStyle());
        if (pref.getGuestCount() != null) prefs.put("guest_count", pref.getGuestCount());
        if (pref.getPreferredRegions() != null && !pref.getPreferredRegions().isEmpty()) {
            prefs.put("preferred_regions", pref.getPreferredRegions());
        }
        return prefs;
    }

    private static final Pattern HALL_KEYWORDS = Pattern.compile(
            "웨딩홀|예식장|하객|식대|뷔페|채플|호텔웨딩|컨벤션|홀\\s*추천|홀\\s*찾|홀\\s*검색|웨딩\\s*홀"
    );
    private static final Pattern SDM_KEYWORDS = Pattern.compile(
            "드레스|스튜디오|메이크업|헤어|촬영|어울리는\\s*(드레스|스튜디오|메이크업)|드레스업체|드레스샵"
    );

    private String resolveAiEndpoint(String message) {
        // SDM이 홀+스드메 모두 처리 (hall_engine 참조로 홀 검색도 가능)
        // Hall 엔드포인트는 홀 전용 검색이지만 연관 스드메 검색이 없어 대화가 단절됨
        return aiServerUrl + "/api/chat/sdm";
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
        Map<String, Object> context = new HashMap<>();
        if (userId != null) {
            context.put("user_id", userId);
            Long coupleId = resolveCoupleId(userId);
            if (coupleId != null) {
                context.put("couple_id", coupleId);
                // 본인 + 파트너 취향 데이터 포함
                Map<String, Object> prefs = buildCouplePreferences(coupleId, userId);
                if (!prefs.isEmpty()) {
                    context.put("preferences", prefs);
                }
            }
        } else if (request.getUserId() != null) {
            context.put("user_id", request.getUserId());
        }
        if (!context.isEmpty()) {
            body.put("context", context);
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

        List<String> suggestions = (List<String>) data.getOrDefault("suggestions", Collections.emptyList());

        return AiChatResponse.of(answer, returnedSessionId, recommendations, suggestions);
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
            String address = (String) rec.get("address");

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
                        .id(vendor.getId())
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
                        .address(vendor.getAddress() != null ? vendor.getAddress() : address)
                        .build());
            } else {
                enriched.add(AiRecommendation.builder()
                        .id(mysqlSourceId)
                        .source(source)
                        .category(category)
                        .name(title)
                        .reason(reason)
                        .address(address)
                        .build());
            }
        }

        return enriched;
    }
}
