package com.ssafy.sdme.couple.domain;

import com.ssafy.sdme._global.common.entity.BaseIdEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "COUPLE_INVITE")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CoupleInvite extends BaseIdEntity {

    @Column(name = "inviter_id", nullable = false)
    private Long inviterId;

    @Column(name = "accept_id")
    private Long acceptId;

    @Column(name = "invite_code", nullable = false, length = 6)
    private String inviteCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CoupleInviteStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "expired_at")
    private LocalDateTime expiredAt;

    @Column(name = "accepted_at")
    private LocalDateTime acceptedAt;

    @Builder
    public CoupleInvite(Long inviterId, String inviteCode) {
        this.inviterId = inviterId;
        this.inviteCode = inviteCode;
        this.status = CoupleInviteStatus.PENDING;
        this.createdAt = LocalDateTime.now();
        this.expiredAt = LocalDateTime.now().plusDays(1);
    }

    public void accept(Long acceptId) {
        this.acceptId = acceptId;
        this.status = CoupleInviteStatus.ACCEPTED;
        this.acceptedAt = LocalDateTime.now();
    }

    public void expire() {
        this.status = CoupleInviteStatus.EXPIRED;
    }

    public boolean isExpired() {
        return expiredAt != null && LocalDateTime.now().isAfter(expiredAt);
    }
}
