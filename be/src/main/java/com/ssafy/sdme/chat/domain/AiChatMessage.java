package com.ssafy.sdme.chat.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "AI_CHAT_MESSAGES")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AiChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "couple_id")
    private Long coupleId;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "session_id", nullable = false, length = 100)
    private String sessionId;

    @Column(name = "role", nullable = false, length = 20)
    private String role;

    @Column(name = "content", columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(name = "recommendations", columnDefinition = "JSON")
    private String recommendations;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Builder
    public AiChatMessage(Long coupleId, Long userId, String sessionId,
                         String role, String content, String recommendations) {
        this.coupleId = coupleId;
        this.userId = userId;
        this.sessionId = sessionId;
        this.role = role;
        this.content = content;
        this.recommendations = recommendations;
        this.createdAt = LocalDateTime.now();
    }
}
