package com.ssafy.sdme.user.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Schema(description = "정보 수정 요청")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserEditRequest {

    @Schema(description = "이름", example = "홍길동")
    private String name;

    @Schema(description = "닉네임", example = "웨딩보이")
    private String nickname;
}
