package com.ssafy.sdme.user.dto.request;

import com.ssafy.sdme.user.domain.PreferredRegion;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Schema(description = "선호도 조사 요청")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserPreferenceRequest {

    @Schema(description = "결혼 예정일", example = "2026-11-15")
    private LocalDate weddingDate;

    @Schema(description = "총 예산", example = "30000000")
    private Integer totalBudget;

    @Schema(description = "스드메 예산", example = "2500000")
    private Integer sdmBudget;

    @Schema(description = "웨딩홀 예산", example = "12000000")
    private Integer hallBudget;

    @Schema(description = "웨딩홀 예약 여부", example = "false")
    private Boolean weddingHallReserved;

    @Schema(description = "스드메 예약 여부", example = "true")
    private Boolean sdmReserved;

    @Schema(description = "선호 웨딩홀 스타일", example = "호텔식")
    private String hallStyle;

    @Schema(description = "예상 하객 수", example = "150")
    private Integer guestCount;

    @Schema(description = "선호 지역 목록")
    private List<PreferredRegion> preferredRegions;
}
