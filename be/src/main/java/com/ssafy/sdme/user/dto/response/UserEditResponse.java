package com.ssafy.sdme.user.dto.response;

import com.ssafy.sdme.couple.domain.Couple;
import com.ssafy.sdme.user.domain.User;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Schema(description = "정보 수정 응답")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserEditResponse {

    @Schema(description = "사용자 ID", example = "1")
    private Long userId;

    @Schema(description = "닉네임", example = "웨딩보이")
    private String nickname;

    @Schema(description = "신랑 이름")
    private String groomName;

    @Schema(description = "신부 이름")
    private String brideName;

    @Schema(description = "신랑 닉네임")
    private String groomNickname;

    @Schema(description = "신부 닉네임")
    private String brideNickname;

    @Schema(description = "신랑 사진 URL")
    private String groomPhoto;

    @Schema(description = "신부 사진 URL")
    private String bridePhoto;

    @Schema(description = "수정일시")
    private LocalDateTime updatedAt;

    public static UserEditResponse of(User user, Couple couple) {
        UserEditResponse response = new UserEditResponse();
        response.userId = user.getId();
        response.nickname = user.getNickname();
        response.updatedAt = user.getUpdatedAt();
        if (couple != null) {
            response.groomName = couple.getGroomName();
            response.brideName = couple.getBrideName();
            response.groomNickname = couple.getGroomNickname();
            response.brideNickname = couple.getBrideNickname();
            response.groomPhoto = couple.getGroomPhoto();
            response.bridePhoto = couple.getBridePhoto();
        }
        return response;
    }
}
