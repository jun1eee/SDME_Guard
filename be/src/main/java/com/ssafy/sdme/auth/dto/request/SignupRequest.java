package com.ssafy.sdme.auth.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Schema(description = "회원가입 - 추가 정보 입력")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SignupRequest {

    @Schema(description = "이름", example = "홍길동")
    @NotBlank(message = "이름은 필수입니다.")
    private String name;

    @Schema(description = "역할 (g: 신랑, b: 신부)", example = "g")
    @NotBlank(message = "역할은 필수입니다.")
    private String role;

    @Schema(description = "닉네임", example = "웨딩보이")
    @NotBlank(message = "닉네임은 필수입니다.")
    private String nickname;
}
