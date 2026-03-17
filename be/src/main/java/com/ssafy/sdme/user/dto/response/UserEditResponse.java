package com.ssafy.sdme.user.dto.response;

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

    @Schema(description = "이름", example = "홍길동")
    private String name;

    @Schema(description = "닉네임", example = "웨딩보이")
    private String nickname;

    @Schema(description = "수정일시")
    private LocalDateTime updatedAt;

    public static UserEditResponse of(User user) {
        UserEditResponse response = new UserEditResponse();
        response.userId = user.getId();
        response.name = user.getName();
        response.nickname = user.getNickname();
        response.updatedAt = user.getUpdatedAt();
        return response;
    }
}
