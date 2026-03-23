package com.ssafy.sdme.budget.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "BUDGET")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Budget {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "couple_id", nullable = false)
    private Long coupleId;

    @Column(name = "total_budget", nullable = false)
    private Integer totalBudget;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Builder
    public Budget(Long coupleId, Integer totalBudget) {
        this.coupleId = coupleId;
        this.totalBudget = totalBudget;
        this.updatedAt = LocalDateTime.now();
    }

    public void updateTotal(Integer totalBudget) {
        this.totalBudget = totalBudget;
        this.updatedAt = LocalDateTime.now();
    }
}
