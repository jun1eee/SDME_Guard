package com.ssafy.sdme.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class AiRecommendation {
    private Long id;
    private String source;      // "sdm" | "hall"
    private String category;    // "studio" | "dress" | "makeup" | "venue"
    private String name;
    private String reason;
    private Double rating;
    private Integer reviewCount;
    private Long price;
    private String imageUrl;
    private String contact;
    private String description;
    private String hashtags;
    private String address;
}
