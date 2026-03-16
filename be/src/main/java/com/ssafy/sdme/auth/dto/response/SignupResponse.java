package com.ssafy.sdme.auth.dto.response;

import com.ssafy.sdme.user.domain.User;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Schema(description = "회원가입 응답")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SignupResponse {

    @Schema(description = "사용자 ID", example = "1")
    private Long userId;

    @Schema(description = "이름", example = "홍길동")
    private String name;

    @Schema(description = "역할", example = "g")
    private String role;

    @Schema(description = "닉네임", example = "웨딩보이")
    private String nickname;

    @Schema(description = "생성일시")
    private LocalDateTime createdAt;

    public static SignupResponse from(User user) {
        SignupResponse response = new SignupResponse();
        response.userId = user.getId();
        response.name = user.getName();
        response.role = user.getRole().name();
        response.nickname = user.getNickname();
        response.createdAt = user.getCreatedAt();
        return response;
    }
}
