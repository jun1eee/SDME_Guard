package com.ssafy.sdme.auth.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Schema(description = "카카오 로그인 요청")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class KakaoLoginRequest {

    @Schema(description = "카카오 인가 코드", example = "abc123")
    private String authorizationCode;
}
