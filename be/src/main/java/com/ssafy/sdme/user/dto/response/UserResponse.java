package com.ssafy.sdme.user.dto.response;

import com.ssafy.sdme.user.domain.User;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;

import java.time.LocalDateTime;

@Schema(description = "사용자 정보 응답")
@Getter
public class UserResponse {

    @Schema(description = "사용자 ID", example = "1")
    private final Long id;

    @Schema(description = "이름", example = "홍길동")
    private final String name;

    @Schema(description = "역할 (g/b)", example = "g")
    private final String role;

    @Schema(description = "닉네임", example = "웨딩보이")
    private final String nickname;

    @Schema(description = "프로필 이미지")
    private final String profileImage;

    @Schema(description = "커플 ID", example = "1")
    private final Long coupleId;

    @Schema(description = "상대방 닉네임", example = "웨딩걸")
    private final String partnerNickname;

    @Schema(description = "생성일시")
    private final LocalDateTime createdAt;

    private UserResponse(User user, String partnerNickname) {
        this.id = user.getId();
        this.name = user.getName();
        this.role = user.getRole() != null ? user.getRole().name() : null;
        this.nickname = user.getNickname();
        this.profileImage = user.getProfileImage();
        this.coupleId = user.getCoupleId();
        this.partnerNickname = partnerNickname;
        this.createdAt = user.getCreatedAt();
    }

    public static UserResponse of(User user, String partnerNickname) {
        return new UserResponse(user, partnerNickname);
    }
}
