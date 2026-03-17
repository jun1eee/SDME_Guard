package com.ssafy.sdme.couple.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;

@Schema(description = "초대코드 생성 응답")
@Getter
public class CoupleInviteResponse {

    @Schema(description = "초대코드 (6자리)", example = "A1B2C3")
    private final String inviteCode;

    private CoupleInviteResponse(String inviteCode) {
        this.inviteCode = inviteCode;
    }

    public static CoupleInviteResponse of(String inviteCode) {
        return new CoupleInviteResponse(inviteCode);
    }
}
