package com.ssafy.sdme.vendor.domain;

import com.ssafy.sdme._global.common.entity.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Entity
@Table(name = "VENDOR")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Vendor extends BaseTimeEntity {

    @Column(nullable = false, unique = true)
    private Long sourceId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 30)
    private String category;

    @Column(nullable = false)
    private Double rating;

    @Column(nullable = false)
    private Integer reviewCount;

    @Column(nullable = false, length = 500)
    private String imageUrl;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String hashtags;

    @Column(nullable = false)
    private Long price;

    @Column(length = 255)
    private String contact;

    @Column
    private LocalDateTime crawledAt;

    @Builder
    private Vendor(
        Long sourceId,
        String name,
        String category,
        Double rating,
        Integer reviewCount,
        String imageUrl,
        String description,
        String hashtags,
        Long price,
        String contact,
        LocalDateTime crawledAt
    ) {
        this.sourceId = sourceId;
        this.name = name;
        this.category = category;
        this.rating = rating;
        this.reviewCount = reviewCount;
        this.imageUrl = imageUrl;
        this.description = description;
        this.hashtags = hashtags;
        this.price = price;
        this.contact = contact;
        this.crawledAt = crawledAt;
    }
}
