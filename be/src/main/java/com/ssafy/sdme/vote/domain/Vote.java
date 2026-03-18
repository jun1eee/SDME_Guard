package com.ssafy.sdme.vote.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "VOTES")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Vote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "vote_items_id", nullable = false)
    private Long voteItemId;

    @Enumerated(EnumType.STRING)
    private VoteScore score;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(name = "is_edited")
    private Boolean isEdited;

    @Column(name = "voted_at")
    private LocalDateTime votedAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    public Vote(Long userId, Long voteItemId, VoteScore score, String reason) {
        this.userId = userId;
        this.voteItemId = voteItemId;
        this.score = score;
        this.reason = reason;
        this.isEdited = false;
        this.votedAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public void updateVote(VoteScore score, String reason) {
        this.score = score;
        this.reason = reason;
        this.isEdited = true;
        this.updatedAt = LocalDateTime.now();
    }

    public enum VoteScore {
        great, good, neutral, bad, notinterested
    }
}
