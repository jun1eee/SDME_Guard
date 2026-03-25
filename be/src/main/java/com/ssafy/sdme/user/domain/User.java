package com.ssafy.sdme.user.domain;

import com.ssafy.sdme._global.common.entity.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "USER")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User extends BaseTimeEntity {

    @Column(name = "couple_id")
    private Long coupleId;

    @Column(length = 100)
    private String name;

    @Column(name = "kakao_id", nullable = false, length = 100)
    private String kakaoId;

    @Column(length = 100)
    private String nickname;

    @Column(name = "profile_image", length = 500)
    private String profileImage;

    @Enumerated(EnumType.STRING)
    private Role role;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Builder
    public User(String kakaoId, String nickname, String profileImage) {
        this.kakaoId = kakaoId;
        this.nickname = nickname;
        this.profileImage = profileImage;
    }

    public void updateCoupleId(Long coupleId) {
        this.coupleId = coupleId;
    }

    public void updateProfile(String name, Role role, String nickname) {
        this.name = name;
        this.role = role;
        this.nickname = nickname;
    }

    public void editInfo(String name, String nickname) {
        if (name != null) this.name = name;
        if (nickname != null) this.nickname = nickname;
    }

    public void withdraw() {
        this.deletedAt = LocalDateTime.now();
        this.coupleId = null;
    }

    public void updateProfileImage(String profileImage) {
        this.profileImage = profileImage;
    }

    public void rejoin(String nickname, String profileImage) {
        this.deletedAt = null;
        this.name = null;
        this.role = null;
        this.nickname = nickname;
        this.profileImage = profileImage;
        this.coupleId = null;
    }
}
