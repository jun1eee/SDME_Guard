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

    public void disconnect() {
        this.status = CoupleStatus.DISCONNECTED;
    }
}
