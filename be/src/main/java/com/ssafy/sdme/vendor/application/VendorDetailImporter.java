package com.ssafy.sdme.vendor.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.sdme.vendor.domain.Vendor;
import com.ssafy.sdme.vendor.domain.VendorAdditionalProduct;
import com.ssafy.sdme.vendor.domain.VendorImage;
import com.ssafy.sdme.vendor.domain.VendorPackage;
import com.ssafy.sdme.vendor.domain.VendorPackageItem;
import com.ssafy.sdme.vendor.repository.*;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.DependsOn;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Slf4j
@Component
@DependsOn({"vendorJsonImporter"})
@RequiredArgsConstructor
public class VendorDetailImporter {

    private static final long STUDIO_OFFSET = 3_000_000L;
    private static final long DRESS_OFFSET  = 4_000_000L;
    private static final long MAKEUP_OFFSET = 5_000_000L;

    private final VendorRepository vendorRepository;
    private final VendorPackageRepository vendorPackageRepository;
    private final VendorPackageItemRepository vendorPackageItemRepository;
    private final VendorAdditionalProductRepository vendorAdditionalProductRepository;
    private final VendorImageRepository vendorImageRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @PostConstruct
    @Transactional
    public void importIfEmpty() {
        importCategory("data/iwedding_studio_detail.json", "STUDIO", STUDIO_OFFSET);
        importCategory("data/iwedding_dress_detail.json",  "DRESS",  DRESS_OFFSET);
        importCategory("data/iwedding_makeup_detail.json", "MAKEUP", MAKEUP_OFFSET);
    }

    private void importCategory(String path, String category, long offset) {
        ClassPathResource resource = new ClassPathResource(path);
        if (!resource.exists()) {
            log.warn("Detail JSON not found: {}", path);
            return;
        }

        // DB에서 카테고리 벤더를 먼저 Map으로 로드 (sourceId → vendor)
        Map<Long, Vendor> vendorMap =
            vendorRepository.findAllByCategory(category).stream()
                .collect(Collectors.toMap(
                    Vendor::getSourceId,
                    v -> v,
                    (a, b) -> a
                ));

        if (vendorMap.isEmpty()) {
            log.info("No {} vendors in DB, skipping detail import", category);
            return;
        }

        try (InputStream is = resource.getInputStream()) {
            JsonNode root = objectMapper.readTree(is);
            int count = 0;
            for (JsonNode node : root) {
                if (importOne(node, offset, vendorMap)) count++;
            }
            log.info("Imported detail for {} vendors from {}", count, path);
        } catch (IOException e) {
            log.error("Failed to read detail JSON: {}", path, e);
        }
    }

    private boolean importOne(JsonNode node, long offset, Map<Long, Vendor> vendorMap) {
        String raw = node.path("iwedding_no").asText(null);
        if (raw == null || raw.isBlank()) return false;

        long sourceId;
        try {
            sourceId = offset + Long.parseLong(raw.trim());
        } catch (NumberFormatException e) {
            return false;
        }

        com.ssafy.sdme.vendor.domain.Vendor vendor = vendorMap.get(sourceId);
        if (vendor == null) return false;

        long vendorId = vendor.getId();

        if (vendorPackageRepository.existsByVendorId(vendorId)) return false;

        // VENDOR_PACKAGE
        String tabName = node.path("iwedding_product_name").asText(null);
        long price = node.path("salePrice").asLong(0L);
        VendorPackage pkg = vendorPackageRepository.save(
            VendorPackage.builder().vendorId(vendorId).tabName(tabName).price(price).build()
        );

        // VENDOR_PACKAGE_ITEM
        List<VendorPackageItem> items = new ArrayList<>();
        for (JsonNode item : node.path("packageInfo")) {
            String label = item.path("title").asText(null);
            String value = item.path("value").asText(null);
            if (label != null && value != null) {
                items.add(VendorPackageItem.builder()
                    .packageId(pkg.getId()).label(label).value(value).build());
            }
        }
        if (!items.isEmpty()) vendorPackageItemRepository.saveAll(items);

        // VENDOR_ADDITIONAL_PRODUCT
        List<VendorAdditionalProduct> addProducts = new ArrayList<>();
        for (JsonNode opt : node.path("addcostOptions")) {
            String name = opt.path("addcost").asText(null);
            if (name != null && !name.isBlank()) {
                addProducts.add(VendorAdditionalProduct.builder()
                    .vendorId(vendorId)
                    .name(name.replace("\r\n", " ").replace("\n", " ").trim())
                    .price(null)
                    .build());
            }
        }
        if (!addProducts.isEmpty()) vendorAdditionalProductRepository.saveAll(addProducts);

        // VENDOR_IMAGE (coverUrl)
        String coverUrl = node.path("coverUrl").asText(null);
        if (coverUrl != null && !coverUrl.isBlank()) {
            vendorImageRepository.save(
                VendorImage.builder().vendorId(vendorId).imageUrl(coverUrl).orderNum(0).build()
            );
        }

        return true;
    }
}
