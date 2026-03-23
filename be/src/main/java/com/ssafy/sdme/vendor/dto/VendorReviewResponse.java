package com.ssafy.sdme.vendor.dto;

import com.ssafy.sdme.vendor.domain.VendorReview;

public record VendorReviewResponse(
    Long id,
    Float rating,
    String authorName,
    String content,
    String reviewedAt
) {
    public static VendorReviewResponse from(VendorReview review) {
        return new VendorReviewResponse(
            review.getId(),
            review.getRating(),
            null,
            review.getContent(),
            review.getCreatedAt() != null ? review.getCreatedAt().toString() : null
        );
    }

    public static VendorReviewResponse from(VendorReview review, String authorName) {
        return new VendorReviewResponse(
            review.getId(),
            review.getRating(),
            authorName,
            review.getContent(),
            review.getCreatedAt() != null ? review.getCreatedAt().toString() : null
        );
    }
}
