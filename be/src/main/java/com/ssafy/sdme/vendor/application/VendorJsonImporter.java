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
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class
VendorJsonImporter {

    private static final long STUDIO_OFFSET = 3_000_000L;
    private static final long DRESS_OFFSET  = 4_000_000L;
    private static final long MAKEUP_OFFSET = 5_000_000L;

    private final VendorRepository vendorRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @PostConstruct
    @Transactional
    public void importIfEmpty() {
        importCategory("data/iwedding_studio_list.json", "STUDIO", STUDIO_OFFSET);
        importCategory("data/iwedding_dress_list.json",  "DRESS",  DRESS_OFFSET);
        importCategory("data/iwedding_makeup_list.json", "MAKEUP", MAKEUP_OFFSET);
    }

    private void importCategory(String path, String category, long offset) {
        if (vendorRepository.countByCategory(category) > 0) {
            log.info("Skip {} import: already has data.", category);
            return;
        }
        List<Vendor> vendors = readVendors(path, category, offset);
        vendorRepository.saveAll(vendors);
        log.info("Imported {} {} vendors from {}", vendors.size(), category, path);
    }

    private List<Vendor> readVendors(String path, String category, long offset) {
        ClassPathResource resource = new ClassPathResource(path);
        try (InputStream inputStream = resource.getInputStream()) {
            JsonNode root = objectMapper.readTree(inputStream);
            List<Vendor> vendors = new ArrayList<>();
            for (JsonNode node : root) {
                vendors.add(toVendor(node, category, offset));
            }
            return vendors;
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read JSON: " + path, e);
        }
    }

    private Vendor toVendor(JsonNode node, String category, long offset) {
        long iweddingNo = parseLong(node.path("iwedding_no").asText("0"));
        return Vendor.builder()
            .sourceId(offset + iweddingNo)
            .name(node.path("partnerName").asText(""))
            .category(category)
            .rating(node.path("rating").asDouble(0.0))
            .reviewCount(node.path("reviewCount").asInt(0))
            .imageUrl(node.path("thumbnailUrl").asText(""))
            .description(node.path("iwedding_product_name").asText(null))
            .hashtags(buildHashtags(node.path("tags")))
            .price(node.path("salePrice").asLong(0L))
            .address(node.path("address").asText(null))
            .contact(node.path("serviceArea").asText(null))
            .crawledAt(null)
            .build();
    }

    private String buildHashtags(JsonNode tagsNode) {
        if (tagsNode == null || tagsNode.isEmpty()) return "";
        List<String> tags = new ArrayList<>();
        for (JsonNode tag : tagsNode) {
            tags.add(tag.asText());
        }
        return String.join("|", tags);
    }

    private long parseLong(String value) {
        try {
            return Long.parseLong(value.trim());
        } catch (Exception e) {
            return 0L;
        }
    }
}
