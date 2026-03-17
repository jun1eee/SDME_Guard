package com.ssafy.sdme.vendor.dto;

import com.ssafy.sdme.vendor.domain.Vendor;

import java.util.Arrays;
import java.util.List;

public record VendorSummary(
    Long id,
    Long sourceId,
    String name,
    String category,
    Double rating,
    Integer reviewCount,
    String imageUrl,
    String description,
    List<String> hashtags,
    Long price,
    String contact
) {
    public static VendorSummary from(Vendor vendor) {
        return new VendorSummary(
            vendor.getId(),
            vendor.getSourceId(),
            vendor.getName(),
            vendor.getCategory(),
            vendor.getRating(),
            vendor.getReviewCount(),
            vendor.getImageUrl(),
            vendor.getDescription(),
            splitHashtags(vendor.getHashtags()),
            vendor.getPrice(),
            vendor.getContact()
        );
    }

    private static List<String> splitHashtags(String hashtags) {
        if (hashtags == null || hashtags.isBlank()) {
            return List.of();
        }
        return Arrays.stream(hashtags.split("\\|"))
            .map(String::trim)
            .filter(value -> !value.isEmpty())
            .toList();
    }
}
