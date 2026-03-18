package com.ssafy.sdme.favorite.dto;

import com.ssafy.sdme.favorite.domain.Favorite;
import com.ssafy.sdme.vendor.domain.Vendor;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;

import java.time.LocalDateTime;

@Schema(description = "찜 응답")
@Getter
public class FavoriteResponse {

    @Schema(description = "찜 ID")
    private final Long id;

    @Schema(description = "업체 ID")
    private final Long vendorId;

    @Schema(description = "찜한 사용자 ID")
    private final Long userId;

    @Schema(description = "업체 이름")
    private final String name;

    @Schema(description = "카테고리")
    private final String category;

    @Schema(description = "가격")
    private final Long price;

    @Schema(description = "평점")
    private final Double rating;

    @Schema(description = "이미지 URL")
    private final String imageUrl;

    @Schema(description = "설명")
    private final String description;

    @Schema(description = "찜한 시간")
    private final LocalDateTime createdAt;

    private FavoriteResponse(Favorite favorite, Vendor vendor) {
        this.id = favorite.getId();
        this.vendorId = favorite.getVendorId();
        this.userId = favorite.getUserId();
        this.name = vendor != null ? vendor.getName() : null;
        this.category = vendor != null ? vendor.getCategory() : null;
        this.price = vendor != null ? vendor.getPrice() : null;
        this.rating = vendor != null ? vendor.getRating() : null;
        this.imageUrl = vendor != null ? vendor.getImageUrl() : null;
        this.description = vendor != null ? vendor.getDescription() : null;
        this.createdAt = favorite.getCreatedAt();
    }

    public static FavoriteResponse of(Favorite favorite, Vendor vendor) {
        return new FavoriteResponse(favorite, vendor);
    }
}
