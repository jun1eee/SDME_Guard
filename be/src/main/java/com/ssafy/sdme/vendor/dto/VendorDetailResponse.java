package com.ssafy.sdme.vendor.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.ssafy.sdme.vendor.domain.Vendor;
import com.ssafy.sdme.vendor.domain.VendorAdditionalProduct;
import com.ssafy.sdme.vendor.domain.VendorHallDetail;
import com.ssafy.sdme.vendor.domain.VendorImage;
import com.ssafy.sdme.vendor.domain.VendorPackage;
import com.ssafy.sdme.vendor.domain.VendorPackageItem;

import java.util.Arrays;
import java.util.List;
import java.util.function.Function;

public record VendorDetailResponse(
    Long id,
    String name,
    String category,
    Long price,
    Double rating,
    String image,
    String description,
    List<String> hashtags,
    boolean isDressShop,
    VisitInfo visitInfo,
    List<PackageTab> packageTabs,
    List<AdditionalProductGroup> additionalProducts,
    List<String> images,
    boolean booked,
    CategoryExtra studioExtra,
    CategoryExtra dressExtra,
    CategoryExtra makeupExtra,
    List<HallRoom> halls,
    Object hallEvent,
    List<Facility> hallFacilities
) {
    // ── 공통 레코드 ──────────────────────────────────────────────────────────────

    public record VisitInfo(
        String address, String transport, String parking,
        String hours, String closedDays, String lunchBreak,
        String floor, String phone
    ) {}

    public record PackageTab(String tabName, Long price, List<PackageInclude> includes, String imageUrl) {}
    public record PackageInclude(String label, String value) {}
    public record AdditionalProductGroup(String category, List<AdditionalItem> items) {}
    public record AdditionalItem(String name, String price, String condition) {}

    /** studio / dress / makeup 카테고리 공통 extra */
    public record CategoryExtra(String profile, List<PackageInclude> details) {}

    /** hall 카테고리 */
    public record HallRoom(
        Long id, String name,
        Integer guestMin, Integer guestMax,
        String hallType, String style,
        String mealType, Integer mealPrice, Integer rentalPrice,
        String ceremonyType, Integer ceremonyIntervalMin, Integer ceremonyIntervalMax,
        Boolean hasSubway, Boolean hasParking, Boolean hasValet, Boolean hasVirginRoad
    ) {}

    public record Facility(String name) {}

    // ── 팩토리 메서드 ────────────────────────────────────────────────────────────

    public static VendorDetailResponse of(
        Vendor representative,
        List<VendorPackage> packages,
        Function<Long, List<VendorPackageItem>> itemLoader,
        List<VendorAdditionalProduct> additionalProducts,
        List<VendorImage> images,
        java.util.Map<Long, String> packageImageMap,  // vendorId -> imageUrl
        JsonNode detailJson,               // iwedding JSON (studio/dress/makeup) or null
        List<VendorHallDetail> hallDetails, // hall detail rows or empty
        JsonNode hallJson                   // weddingbook JSON (hall) or null
    ) {
        String category = representative.getCategory().toLowerCase();

        List<PackageTab> packageTabs = buildPackageTabs(packages, itemLoader, packageImageMap);
        List<AdditionalProductGroup> addProducts = buildAdditionalProducts(additionalProducts);
        List<String> imageUrls = images.stream().map(VendorImage::getImageUrl).toList();

        VisitInfo visitInfo = "hall".equals(category)
            ? buildVisitInfoFromHall(hallJson)
            : buildVisitInfoFromIwedding(detailJson);

        CategoryExtra studioExtra = "studio".equals(category) ? buildCategoryExtra(detailJson) : null;
        CategoryExtra dressExtra  = "dress".equals(category)  ? buildCategoryExtra(detailJson) : null;
        CategoryExtra makeupExtra = "makeup".equals(category) ? buildCategoryExtra(detailJson) : null;

        List<HallRoom> halls         = "hall".equals(category) ? buildHallRooms(hallDetails) : null;
        List<Facility> hallFacilities = "hall".equals(category) ? buildFacilities(hallJson)   : null;

        return new VendorDetailResponse(
            representative.getId(),
            representative.getName(),
            category,
            representative.getPrice(),
            representative.getRating(),
            representative.getImageUrl(),
            representative.getDescription(),
            splitHashtags(representative.getHashtags()),
            "dress".equals(category),
            visitInfo,
            packageTabs,
            addProducts,
            imageUrls,
            false,
            studioExtra, dressExtra, makeupExtra,
            halls, null, hallFacilities
        );
    }

    // ── packageTabs ──────────────────────────────────────────────────────────────

    private static List<PackageTab> buildPackageTabs(
        List<VendorPackage> packages,
        Function<Long, List<VendorPackageItem>> itemLoader,
        java.util.Map<Long, String> packageImageMap
    ) {
        return packages.stream()
            .map(pkg -> new PackageTab(
                pkg.getTabName(),
                pkg.getPrice(),
                itemLoader.apply(pkg.getId()).stream()
                    .map(i -> new PackageInclude(i.getLabel(), i.getValue()))
                    .toList(),
                packageImageMap.getOrDefault(pkg.getVendorId(), null)
            ))
            .toList();
    }

    // ── additionalProducts ───────────────────────────────────────────────────────

    private static List<AdditionalProductGroup> buildAdditionalProducts(
        List<VendorAdditionalProduct> additionalProducts
    ) {
        List<AdditionalItem> items = additionalProducts.stream()
            .map(p -> new AdditionalItem(p.getName(), p.getPrice(), null))
            .toList();
        return items.isEmpty()
            ? List.of()
            : List.of(new AdditionalProductGroup("추가 비용", items));
    }

    // ── visitInfo ────────────────────────────────────────────────────────────────

    private static VisitInfo buildVisitInfoFromIwedding(JsonNode detail) {
        if (detail == null) return null;
        String address = nullIfBlank(detail.path("address").asText(null));
        String phone   = nullIfBlank(detail.path("tel").asText(null));
        String closed  = nullIfBlank(detail.path("holiday").asText(null));
        if (address == null && phone == null && closed == null) return null;
        return new VisitInfo(address, null, null, null, closed, null, null, phone);
    }

    private static VisitInfo buildVisitInfoFromHall(JsonNode detail) {
        if (detail == null) return null;
        String address   = nullIfBlank(detail.path("address").asText(null));
        String transport = nullIfBlank(detail.path("address2").asText(null));
        String phone     = nullIfBlank(detail.path("tel").asText(null));
        if (address == null && phone == null) return null;
        return new VisitInfo(address, transport, null, null, null, null, null, phone);
    }

    // ── CategoryExtra (studio / dress / makeup) ──────────────────────────────────

    private static CategoryExtra buildCategoryExtra(JsonNode detail) {
        if (detail == null) return null;
        String profile = nullIfBlank(detail.path("detailCmt").asText(null));
        if (profile == null) profile = nullIfBlank(detail.path("profile").asText(null));

        List<PackageInclude> details = new java.util.ArrayList<>();
        for (JsonNode item : detail.path("packageInfo")) {
            String label = nullIfBlank(item.path("title").asText(null));
            String value = nullIfBlank(item.path("value").asText(null));
            if (label != null && value != null) {
                details.add(new PackageInclude(label, value));
            }
        }
        if (profile == null && details.isEmpty()) return null;
        return new CategoryExtra(profile, details);
    }

    // ── halls ────────────────────────────────────────────────────────────────────

    private static List<HallRoom> buildHallRooms(List<VendorHallDetail> hallDetails) {
        if (hallDetails == null || hallDetails.isEmpty()) return List.of();
        return hallDetails.stream()
            .map(h -> new HallRoom(
                h.getId(), h.getName(),
                h.getGuestMin(), h.getGuestMax(),
                h.getHallType(), h.getStyle(),
                h.getMealType(), h.getMealPrice(), h.getRentalPrice(),
                h.getCeremonyType(), h.getCeremonyIntervalMin(), h.getCeremonyIntervalMax(),
                h.isHasSubway(), h.isHasParking(), h.isHasValet(), h.isHasVirginRoad()
            ))
            .toList();
    }

    // ── hallFacilities ───────────────────────────────────────────────────────────

    private static List<Facility> buildFacilities(JsonNode detail) {
        if (detail == null) return List.of();
        String memo = detail.path("memoContent").asText(null);
        if (memo == null || !memo.contains("체크리스트")) return List.of();

        List<Facility> facilities = new java.util.ArrayList<>();
        boolean inChecklist = false;
        for (String line : memo.split("[\\r\\n]+")) {
            String trimmed = line.trim();
            if (trimmed.contains("체크리스트")) {
                inChecklist = true;
                continue;
            }
            if (inChecklist) {
                if (trimmed.startsWith("💒")) break;
                String item = trimmed.replaceFirst("^[-•]\\s*", "");
                if (!item.isBlank()) {
                    facilities.add(new Facility(item));
                }
            }
        }
        return facilities;
    }

    // ── 공통 유틸 ────────────────────────────────────────────────────────────────

    private static List<String> splitHashtags(String hashtags) {
        if (hashtags == null || hashtags.isBlank()) return List.of();
        return Arrays.stream(hashtags.split("\\|"))
            .map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    private static String nullIfBlank(String v) {
        return (v == null || v.isBlank()) ? null : v;
    }
}
