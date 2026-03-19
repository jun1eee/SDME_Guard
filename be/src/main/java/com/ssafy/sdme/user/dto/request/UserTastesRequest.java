package com.ssafy.sdme.user.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Schema(description = "취향 수정 요청")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserTastesRequest {

    @Schema(description = "웨딩 스타일", example = "[\"클래식\", \"모던\"]")
    private List<String> styles;

    @Schema(description = "컬러 테마", example = "[\"화이트\", \"골드\"]")
    private List<String> colors;

    @Schema(description = "분위기", example = "[\"로맨틱\", \"우아함\"]")
    private List<String> moods;

    @Schema(description = "식사 선호", example = "[\"한식뷔페\", \"양식코스\"]")
    private List<String> foods;
}
