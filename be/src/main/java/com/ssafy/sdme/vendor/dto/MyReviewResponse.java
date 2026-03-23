package com.ssafy.sdme.vendor.dto;

import com.ssafy.sdme.vendor.domain.Vendor;
import com.ssafy.sdme.vendor.domain.VendorReview;

public record MyReviewResponse(
    Long id,
    Long vendorId,
    String vendorName,
    String vendorCategory,
    Float rating,
    String content,
    String reviewedAt
) {
    public static MyReviewResponse from(VendorReview review, Vendor vendor) {
        return new MyReviewResponse(
            review.getId(),
            vendor.getId(),
            vendor.getName(),
            vendor.getCategory(),
            review.getRating(),
            review.getContent(),
            review.getCreatedAt() != null ? review.getCreatedAt().toString() : null
        );
    }
}