package com.ssafy.sdme.couple.dto.response;

import com.ssafy.sdme.couple.domain.Couple;
import com.ssafy.sdme.user.domain.User;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Schema(description = "커플 정보 응답")
@Getter
public class CoupleResponse {

    @Schema(description = "커플 ID", example = "1")
    private final Long coupleId;

    @Schema(description = "결혼 예정일", example = "2026-06-15")
    private final LocalDate weddingDate;

    @Schema(description = "총 예산", example = "5000")
    private final Integer totalBudget;

    @Schema(description = "연결 일시")
    private final LocalDateTime connectedAt;

    @Schema(description = "상태", example = "MATCHED")
    private final String status;

    @Schema(description = "신랑 정보")
    private final MemberInfo groom;

    @Schema(description = "신부 정보")
    private final MemberInfo bride;

    @Getter
    public static class MemberInfo {
        private final Long id;
        private final String name;
        private final String nickname;
        private final String profileImage;

        public MemberInfo(User user) {
            this.id = user.getId();
            this.name = user.getName();
            this.nickname = user.getNickname();
            this.profileImage = user.getProfileImage();
        }
    }

    private CoupleResponse(Couple couple, User groom, User bride) {
        this.coupleId = couple.getId();
        this.weddingDate = couple.getWeddingDate();
        this.totalBudget = couple.getTotalBudget();
        this.connectedAt = couple.getConnectedAt();
        this.status = couple.getStatus().name();
        this.groom = groom != null ? new MemberInfo(groom) : null;
        this.bride = bride != null ? new MemberInfo(bride) : null;
    }

    public static CoupleResponse of(Couple couple, User groom, User bride) {
        return new CoupleResponse(couple, groom, bride);
    }
}
