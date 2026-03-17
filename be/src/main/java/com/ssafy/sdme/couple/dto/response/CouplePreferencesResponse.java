package com.ssafy.sdme.couple.dto.response;

import com.ssafy.sdme.user.dto.response.UserPreferenceResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;

@Schema(description = "커플 취향&선호도 응답")
@Getter
public class CouplePreferencesResponse {

    @Schema(description = "신랑 선호도")
    private final UserPreferenceResponse groom;

    @Schema(description = "신부 선호도")
    private final UserPreferenceResponse bride;

    private CouplePreferencesResponse(UserPreferenceResponse groom, UserPreferenceResponse bride) {
        this.groom = groom;
        this.bride = bride;
    }

    public static CouplePreferencesResponse of(UserPreferenceResponse groom, UserPreferenceResponse bride) {
        return new CouplePreferencesResponse(groom, bride);
    }
}
