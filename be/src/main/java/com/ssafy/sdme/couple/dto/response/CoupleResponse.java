package com.ssafy.sdme.couple.dto.response;

import com.ssafy.sdme.couple.domain.Couple;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Schema(description = "커플 정보 응답")
@Getter
public class CoupleResponse {

    @Schema(description = "커플 ID", example = "1")
    private final Long coupleId;

    @Schema(description = "신랑 ID", example = "1")
    private final Long groomId;

    @Schema(description = "신부 ID", example = "2")
    private final Long brideId;

    @Schema(description = "결혼 예정일", example = "2026-06-15")
    private final LocalDate weddingDate;

    @Schema(description = "총 예산", example = "5000")
    private final Integer totalBudget;

    @Schema(description = "연결 일시")
    private final LocalDateTime connectedAt;

    @Schema(description = "상태", example = "MATCHED")
    private final String status;

    @Schema(description = "상대방 닉네임", example = "웨딩걸")
    private final String partnerNickname;

    private CoupleResponse(Couple couple, String partnerNickname) {
        this.coupleId = couple.getId();
        this.groomId = couple.getGroomId();
        this.brideId = couple.getBrideId();
        this.weddingDate = couple.getWeddingDate();
        this.totalBudget = couple.getTotalBudget();
        this.connectedAt = couple.getConnectedAt();
        this.status = couple.getStatus().name();
        this.partnerNickname = partnerNickname;
    }

    public static CoupleResponse of(Couple couple, String partnerNickname) {
        return new CoupleResponse(couple, partnerNickname);
    }
}
