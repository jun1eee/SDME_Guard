package com.ssafy.sdme.vendor.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.ssafy.sdme.vendor.dto.VendorDetailResponse;
import com.ssafy.sdme.vendor.dto.VendorListResponse;
import com.ssafy.sdme.vendor.dto.VendorSummary;
import com.ssafy.sdme.vendor.domain.Vendor;
import com.ssafy.sdme.vendor.domain.VendorHallDetail;
import com.ssafy.sdme.vendor.domain.VendorPackage;
import com.ssafy.sdme.vendor.repository.*;
import com.ssafy.sdme._global.exception.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class VendorQueryService {

    private final VendorRepository vendorRepository;
    private final VendorCursorRepository vendorCursorRepository;
    private final VendorDetailStore vendorDetailStore;
    private final HallDetailStore hallDetailStore;
    private final VendorPackageRepository vendorPackageRepository;
    private final VendorPackageItemRepository vendorPackageItemRepository;
    private final VendorAdditionalProductRepository vendorAdditionalProductRepository;
    private final VendorImageRepository vendorImageRepository;
    private final VendorHallDetailRepository vendorHallDetailRepository;

    public VendorListResponse getVendors(
        String category, String keyword,
        Long minPrice, Long maxPrice,
        Double rating, String sort, String cursor, int size
    ) {
        int fetchLimit = size + 1;
        List<VendorSummary> rows = vendorCursorRepository.find(
            category, keyword, minPrice, maxPrice, rating, sort, cursor, fetchLimit
        );
        boolean hasNext = rows.size() > size;
        List<VendorSummary> items = hasNext ? rows.subList(0, size) : rows;
        String nextCursor = hasNext ? encodeCursor(items.get(items.size() - 1), sort) : null;
        return new VendorListResponse(items, nextCursor);
    }

    public VendorDetailResponse getVendorDetailBySourceId(Long sourceId) {
        Vendor representative = vendorRepository.findBySourceId(sourceId)
            .orElseThrow(() -> new NotFoundException("업체를 찾을 수 없습니다. (sourceId: " + sourceId + ")"));
        return buildVendorDetail(representative);
    }

    public VendorDetailResponse getVendorDetail(Long id) {
        Vendor representative = vendorRepository.findById(id)
            .or(() -> vendorRepository.findBySourceId(id))
            .orElseThrow(() -> new NotFoundException("업체를 찾을 수 없습니다."));
        return buildVendorDetail(representative);
    }

    private VendorDetailResponse buildVendorDetail(Vendor representative) {
        String category = representative.getCategory().toUpperCase(Locale.ROOT);
        boolean isHall = "HALL".equals(category);

        List<Vendor> sameNameVendors = isHall ? List.of()
            : vendorRepository.findByNameAndCategory(representative.getName(), representative.getCategory());

        List<VendorPackage> packages = isHall ? List.of()
            : sameNameVendors.stream()
                .flatMap(v -> vendorPackageRepository.findByVendorId(v.getId()).stream())
                .toList();

        Map<Long, String> packageImageMap = isHall ? Map.of()
            : vendorImageRepository.findByVendorIdIn(
                sameNameVendors.stream().map(Vendor::getId).toList()
              ).stream()
              .collect(Collectors.toMap(
                  img -> img.getVendorId(),
                  img -> img.getImageUrl(),
                  (a, b) -> a  // keep first image per vendor
              ));

        List<VendorHallDetail> hallDetails = isHall
            ? vendorHallDetailRepository.findByVendorId(representative.getId())
            : List.of();

        JsonNode detailJson = isHall ? null : vendorDetailStore.findBySourceId(representative.getSourceId());
        JsonNode hallJson   = isHall ? hallDetailStore.findBySourceId(representative.getSourceId()) : null;

        return VendorDetailResponse.of(
            representative,
            packages,
            vendorPackageItemRepository::findByPackageId,
            vendorAdditionalProductRepository.findByVendorId(representative.getId()),
            vendorImageRepository.findByVendorIdOrderByOrderNum(representative.getId()),
            packageImageMap,
            detailJson,
            hallDetails,
            hallJson
        );
    }

    private String encodeCursor(VendorSummary last, String sort) {
        double value = switch (normalizeSort(sort)) {
            case "rating"            -> last.rating();
            case "priceasc",
                 "pricedesc", "price" -> (double) last.price();
            default                  -> (double) last.reviewCount();
        };
        String raw = value + ":" + last.id();
        return Base64.getEncoder().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    private String normalizeSort(String sort) {
        return sort == null ? "default" : sort.trim().toLowerCase(Locale.ROOT);
    }
}
