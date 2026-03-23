package com.ssafy.sdme.vendor.application;

import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Neo4j partnerId ↔ MySQL sourceId 변환 (단일 책임).
 * 카테고리별 prefix: STUDIO=30, DRESS=40, MAKEUP=50, HALL=없음
 */
@Component
public class VendorIdConverter {

    private static final Map<String, Long> CATEGORY_PREFIX = Map.of(
            "studio", 3_000_000L,
            "dress", 4_000_000L,
            "makeup", 5_000_000L
    );

    public Long toSourceId(long partnerId, String category) {
        if (category == null) return partnerId;
        Long prefix = CATEGORY_PREFIX.get(category.toLowerCase());
        if (prefix == null) return partnerId;
        return prefix + partnerId;
    }

    public Long toPartnerId(long sourceId) {
        for (Long prefix : CATEGORY_PREFIX.values()) {
            if (sourceId > prefix && sourceId < prefix + 1_000_000L) {
                return sourceId - prefix;
            }
        }
        return sourceId;
    }
}
