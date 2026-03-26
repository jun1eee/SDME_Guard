package com.ssafy.sdme.chat.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "COUPLE_CHAT_ROOMS")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CoupleChatRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "couple_id", nullable = false)
    private Long coupleId;

    @Column(name = "ai_mode")
    private Boolean aiMode;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "groom_ai_session_id", length = 100)
    private String groomAiSessionId;

    @Column(name = "bride_ai_session_id", length = 100)
    private String brideAiSessionId;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    public CoupleChatRoom(Long coupleId) {
        this.coupleId = coupleId;
        this.aiMode = false;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public void setGroomAiSessionId(String groomAiSessionId) {
        this.groomAiSessionId = groomAiSessionId;
        this.updatedAt = LocalDateTime.now();
    }

    public void setBrideAiSessionId(String brideAiSessionId) {
        this.brideAiSessionId = brideAiSessionId;
        this.updatedAt = LocalDateTime.now();
    }
}
