package com.ssafy.sdme.auth.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class KakaoUserInfoResponse {

    @JsonProperty("id")
    private Long id;

    @JsonProperty("kakao_account")
    private KakaoAccount kakaoAccount;

    @Getter
    @NoArgsConstructor
    public static class KakaoAccount {

        @JsonProperty("profile")
        private Profile profile;

        @Getter
        @NoArgsConstructor
        public static class Profile {

            @JsonProperty("nickname")
            private String nickname;

            @JsonProperty("profile_image_url")
            private String profileImageUrl;
        }
    }

    public String getKakaoId() {
        return String.valueOf(id);
    }

    public String getNickname() {
        if (kakaoAccount != null && kakaoAccount.getProfile() != null) {
            return kakaoAccount.getProfile().getNickname();
        }
        return null;
    }

    public String getProfileImageUrl() {
        if (kakaoAccount != null && kakaoAccount.getProfile() != null) {
            return kakaoAccount.getProfile().getProfileImageUrl();
        }
        return null;
    }
}
