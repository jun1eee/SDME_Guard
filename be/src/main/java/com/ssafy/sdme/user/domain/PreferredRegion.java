package com.ssafy.sdme.user.domain;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Schema(description = "선호 지역")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PreferredRegion {

    @Schema(description = "시/도", example = "서울특별시")
    private String city;

    @Schema(description = "구/군 목록", example = "[\"강남구\", \"송파구\"]")
    private List<String> districts;

    public PreferredRegion(String city, List<String> districts) {
        this.city = city;
        this.districts = districts;
    }
}
