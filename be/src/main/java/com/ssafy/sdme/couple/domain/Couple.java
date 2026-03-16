package com.ssafy.sdme.couple.domain;

import com.ssafy.sdme._global.common.entity.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "COUPLE")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Couple extends BaseTimeEntity {

    @Column(name = "groom_id")
    private Long groomId;

    @Column(name = "bride_id")
    private Long brideId;

    @Column(name = "groom_name", length = 50)
    private String groomName;

    @Column(name = "bride_name", length = 50)
    private String brideName;

    @Column(name = "groom_nickname", length = 100)
    private String groomNickname;

    @Column(name = "bride_nickname", length = 100)
    private String brideNickname;

    @Column(name = "groom_photo", length = 500)
    private String groomPhoto;

    @Column(name = "bride_photo", length = 500)
    private String bridePhoto;

    @Column(name = "wedding_date")
    private LocalDate weddingDate;

    @Column(name = "total_budget")
    private Integer totalBudget;

    @Column(name = "connected_at")
    private LocalDateTime connectedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CoupleStatus status;

    @Builder
    public Couple(Long groomId, Long brideId, LocalDate weddingDate, Integer totalBudget) {
        this.groomId = groomId;
        this.brideId = brideId;
        this.weddingDate = weddingDate;
        this.totalBudget = totalBudget;
        this.status = CoupleStatus.PENDING;
    }

    public void matchBride(Long brideId) {
        this.brideId = brideId;
        this.status = CoupleStatus.MATCHED;
        this.connectedAt = LocalDateTime.now();
    }

    public void matchGroom(Long groomId) {
        this.groomId = groomId;
        this.status = CoupleStatus.MATCHED;
        this.connectedAt = LocalDateTime.now();
    }

    public void updateInfo(String groomName, String brideName,
                           String groomNickname, String brideNickname,
                           String groomPhoto, String bridePhoto) {
        this.groomName = groomName;
        this.brideName = brideName;
        this.groomNickname = groomNickname;
        this.brideNickname = brideNickname;
        this.groomPhoto = groomPhoto;
        this.bridePhoto = bridePhoto;
    }
}
