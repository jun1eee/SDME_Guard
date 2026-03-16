package com.ssafy.sdme.auth.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Schema(description = "로그인 응답")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LoginResponse {

    @Schema(description = "신규 사용자 여부")
    private boolean isNewUser;

    @Schema(description = "Access Token")
    private String accessToken;

    @Schema(description = "Refresh Token")
    private String refreshToken;

    @Schema(description = "카카오 닉네임")
    private String kakaoNickname;

    @Schema(description = "카카오 프로필 이미지")
    private String kakaoProfileImage;

    public static LoginResponse of(boolean isNewUser, String accessToken, String refreshToken,
                                    String kakaoNickname, String kakaoProfileImage) {
        LoginResponse response = new LoginResponse();
        response.isNewUser = isNewUser;
        response.accessToken = accessToken;
        response.refreshToken = refreshToken;
        response.kakaoNickname = kakaoNickname;
        response.kakaoProfileImage = kakaoProfileImage;
        return response;
    }
}
