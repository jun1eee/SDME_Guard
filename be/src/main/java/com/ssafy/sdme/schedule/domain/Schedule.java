package com.ssafy.sdme.schedule.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "SCHEDULE")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Schedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "couple_id")
    private Long coupleId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(name = "date")
    private LocalDate date;

    @Column(name = "time")
    private LocalTime time;

    @Column(length = 300)
    private String location;

    @Column(columnDefinition = "TEXT")
    private String memo;

    @Enumerated(EnumType.STRING)
    @Column(columnDefinition = "ENUM('STUDIO','DRESS','MAKEUP','HALL')")
    private ScheduleCategory category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "ENUM('대기중','진행중','완료')")
    private ScheduleStatus status;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Enumerated(EnumType.STRING)
    @Column(columnDefinition = "ENUM('USER','AI')")
    private ScheduleSource source;

    @Column(name = "reservation_id")
    private Long reservationId;

    @Builder
    public Schedule(Long userId, Long coupleId, String title, LocalDate date, LocalTime time,
                    String location, String memo, ScheduleCategory category, ScheduleSource source, Long reservationId) {
        this.userId = userId;
        this.coupleId = coupleId;
        this.title = title;
        this.date = date;
        this.time = time;
        this.location = location;
        this.memo = memo;
        this.category = category;
        this.source = source != null ? source : ScheduleSource.USER;
        this.reservationId = reservationId;
        this.status = ScheduleStatus.대기중;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public void update(String title, LocalDate date, LocalTime time, String location, String memo, ScheduleCategory category) {
        if (title != null) this.title = title;
        if (date != null) this.date = date;
        if (time != null) this.time = time;
        if (location != null) this.location = location;
        if (memo != null) this.memo = memo;
        if (category != null) this.category = category;
        this.updatedAt = LocalDateTime.now();
    }

    public void updateStatus(ScheduleStatus status) {
        this.status = status;
        this.updatedAt = LocalDateTime.now();
    }

    public void delete() {
        this.deletedAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public enum ScheduleStatus {
        대기중, 진행중, 완료
    }

    public enum ScheduleCategory {
        STUDIO, DRESS, MAKEUP, HALL
    }

    public enum ScheduleSource {
        USER, AI
    }
}
