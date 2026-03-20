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
public class VendorDetailStore {

    private static final long STUDIO_OFFSET = 3_000_000L;
    private static final long DRESS_OFFSET  = 4_000_000L;
    private static final long MAKEUP_OFFSET = 5_000_000L;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<Long, JsonNode> detailBySourceId = new HashMap<>();

    @PostConstruct
    public void load() {
        loadFile("data/iwedding_studio_detail.json", STUDIO_OFFSET);
        loadFile("data/iwedding_dress_detail.json",  DRESS_OFFSET);
        loadFile("data/iwedding_makeup_detail.json", MAKEUP_OFFSET);
        log.info("Loaded {} vendor details", detailBySourceId.size());
    }

    private void loadFile(String path, long offset) {
        ClassPathResource resource = new ClassPathResource(path);
        try (InputStream is = resource.getInputStream()) {
            JsonNode root = objectMapper.readTree(is);
            for (JsonNode node : root) {
                long partnerId = node.path("partnerId").asLong(0);
                if (partnerId == 0) continue;
                long sourceId = offset + partnerId;
                detailBySourceId.put(sourceId, node);
            }
        } catch (IOException e) {
            log.warn("Failed to load vendor detail: {}", path, e);
        }
    }

    public JsonNode findBySourceId(Long sourceId) {
        return detailBySourceId.get(sourceId);
    }
}
