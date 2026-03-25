package com.ssafy.sdme.vendor.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.sdme.vendor.domain.Vendor;
import com.ssafy.sdme.vendor.repository.VendorRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class VendorCsvImporter {

    private static final String LIST_PATH   = "data/weddingbook_halls_reco_list.json";
    private static final String DETAIL_PATH = "data/weddingbook_halls_reco_detail.json";

    private final VendorRepository vendorRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @PostConstruct
    @Transactional
    public void importIfEmpty() {
        if (vendorRepository.countByCategory("HALL") > 0) {
            // 기존 데이터 해시태그 정리 (타입/메뉴/예식형태만 유지)
            updateHallHashtags();
            return;
        }

        Map<Long, JsonNode> listByPartnerId = loadListJson();
        List<Vendor> vendors = loadDetailJson(listByPartnerId);
        vendorRepository.saveAll(vendors);
        log.info("Imported {} HALL vendors from weddingbook reco JSON", vendors.size());
    }

    private void updateHallHashtags() {
        try {
            ClassPathResource resource = new ClassPathResource(DETAIL_PATH);
            try (InputStream is = resource.getInputStream()) {
                JsonNode root = objectMapper.readTree(is);
                int updated = 0;
                for (JsonNode node : root) {
                    long partnerId = node.path("partnerId").asLong(0L);
                    if (partnerId <= 0) continue;
                    String newHashtags = buildHashtags(node.path("tags"));
                    vendorRepository.findBySourceId(partnerId).ifPresent(v -> {
                        v.updateHashtags(newHashtags);
                    });
                    updated++;
                }
                log.info("Updated {} HALL vendor hashtags", updated);
            }
        } catch (IOException e) {
            log.warn("Failed to update HALL hashtags: {}", e.getMessage());
        }
    }

    private Map<Long, JsonNode> loadListJson() {
        ClassPathResource resource = new ClassPathResource(LIST_PATH);
        try (InputStream is = resource.getInputStream()) {
            JsonNode root = objectMapper.readTree(is);
            Map<Long, JsonNode> map = new HashMap<>();
            for (JsonNode node : root) {
                long partnerId = node.path("partnerId").asLong(0L);
                if (partnerId > 0) map.put(partnerId, node);
            }
            return map;
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read " + LIST_PATH, e);
        }
    }

    private List<Vendor> loadDetailJson(Map<Long, JsonNode> listByPartnerId) {
        ClassPathResource resource = new ClassPathResource(DETAIL_PATH);
        try (InputStream is = resource.getInputStream()) {
            JsonNode root = objectMapper.readTree(is);
            List<Vendor> vendors = new ArrayList<>();
            for (JsonNode node : root) {
                long partnerId = node.path("partnerId").asLong(0L);
                if (partnerId <= 0) continue;
                JsonNode listNode = listByPartnerId.get(partnerId);
                vendors.add(toVendor(node, listNode));
            }
            return vendors;
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read " + DETAIL_PATH, e);
        }
    }

    private Vendor toVendor(JsonNode detail, JsonNode list) {
        long price = (list != null) ? list.path("minIndividualHallPrice").asLong(0L) : 0L;
        return Vendor.builder()
            .sourceId(detail.path("partnerId").asLong(0L))
            .name(detail.path("name").asText(""))
            .category("HALL")
            .rating(detail.path("rating").asDouble(0.0))
            .reviewCount(detail.path("reviewCnt").asInt(0))
            .imageUrl(detail.path("coverUrl").asText(""))
            .description(blankToNull(detail.path("profile").asText(null)))
            .hashtags(buildHashtags(detail.path("tags")))
            .price(price)
            .address(blankToNull(detail.path("address").asText(null)))
            .contact(blankToNull(detail.path("tel").asText(null)))
            .crawledAt(null)
            .build();
    }

    private static final java.util.Set<String> HALL_TAG_TYPES = java.util.Set.of("타입", "메뉴", "예식형태");

    private String buildHashtags(JsonNode tagsNode) {
        if (tagsNode == null || tagsNode.isEmpty()) return "";
        List<String> tags = new ArrayList<>();
        for (JsonNode tag : tagsNode) {
            String typeName = tag.path("typeName").asText("").trim();
            String name = tag.path("name").asText("").trim();
            if (name.isBlank()) continue;
            // 타입, 메뉴, 예식형태만 포함 (식대 금액, 예식간격 숫자 제외)
            if (!HALL_TAG_TYPES.contains(typeName)) continue;
            if (!tags.contains(name)) tags.add(name);
        }
        return String.join("|", tags);
    }

    private String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }
}
