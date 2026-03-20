package com.ssafy.sdme.vendor.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
public class HallDetailStore {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<Long, JsonNode> detailByPartnerId = new HashMap<>();

    @PostConstruct
    public void load() {
        ClassPathResource resource = new ClassPathResource("data/weddingbook_halls_reco_detail.json");
        if (!resource.exists()) {
            log.warn("weddingbook_halls_reco_detail.json not found");
            return;
        }
        try (InputStream is = resource.getInputStream()) {
            JsonNode root = objectMapper.readTree(is);
            for (JsonNode node : root) {
                long partnerId = node.path("partnerId").asLong(0L);
                if (partnerId > 0) {
                    detailByPartnerId.put(partnerId, node);
                }
            }
            log.info("Loaded {} hall details from weddingbook reco", detailByPartnerId.size());
        } catch (IOException e) {
            log.warn("Failed to load hall detail JSON", e);
        }
    }

    /** sourceId == partnerId (vendor_halls.csv의 id 컬럼) */
    public JsonNode findBySourceId(Long sourceId) {
        return detailByPartnerId.get(sourceId);
    }
}
