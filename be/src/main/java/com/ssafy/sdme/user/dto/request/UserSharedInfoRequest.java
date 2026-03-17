package com.ssafy.sdme.user.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import com.ssafy.sdme.user.domain.PreferredRegion;

import java.time.LocalDate;
import java.util.List;

@Schema(description = "추가 정보 수정 요청 (커플 동기화)")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserSharedInfoRequest {

    @Schema(description = "결혼 예정일", example = "2026-11-15")
    private LocalDate weddingDate;

    @Schema(description = "총 예산 (만원)", example = "5000")
    private Integer totalBudget;

    @Schema(description = "예상 하객 수", example = "200")
    private Integer guestCount;

    @Schema(description = "선호 지역 목록")
    private List<PreferredRegion> preferredRegions;
}
