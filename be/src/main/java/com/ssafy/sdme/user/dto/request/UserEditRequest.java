package com.ssafy.sdme.user.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Schema(description = "정보 수정 요청")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserEditRequest {

    @Schema(description = "닉네임", example = "웨딩보이")
    private String nickname;

    @Schema(description = "신랑 이름 (커플 매칭 후에만 적용)")
    private String groomName;

    @Schema(description = "신부 이름 (커플 매칭 후에만 적용)")
    private String brideName;

    @Schema(description = "신랑 닉네임 (커플 매칭 후에만 적용)")
    private String groomNickname;

    @Schema(description = "신부 닉네임 (커플 매칭 후에만 적용)")
    private String brideNickname;

    @Schema(description = "신랑 사진 URL (커플 매칭 후에만 적용)")
    private String groomPhoto;

    @Schema(description = "신부 사진 URL (커플 매칭 후에만 적용)")
    private String bridePhoto;
}
