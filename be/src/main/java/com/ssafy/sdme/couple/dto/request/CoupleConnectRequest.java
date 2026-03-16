package com.ssafy.sdme.couple.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Schema(description = "초대코드 입력 요청")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CoupleConnectRequest {

    @Schema(description = "초대코드 (6자리)", example = "A1B2C3")
    @NotBlank(message = "초대코드는 필수입니다.")
    private String inviteCode;
}
