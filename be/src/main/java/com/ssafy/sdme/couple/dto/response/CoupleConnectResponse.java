package com.ssafy.sdme.couple.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;

@Schema(description = "커플 매칭 응답")
@Getter
public class CoupleConnectResponse {

    @Schema(description = "커플 ID", example = "1")
    private final Long coupleId;

    @Schema(description = "상대방 닉네임", example = "웨딩걸")
    private final String partnerNickname;

    private CoupleConnectResponse(Long coupleId, String partnerNickname) {
        this.coupleId = coupleId;
        this.partnerNickname = partnerNickname;
    }

    public static CoupleConnectResponse of(Long coupleId, String partnerNickname) {
        return new CoupleConnectResponse(coupleId, partnerNickname);
    }
}
