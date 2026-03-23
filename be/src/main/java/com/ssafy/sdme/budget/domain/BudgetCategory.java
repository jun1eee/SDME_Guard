package com.ssafy.sdme.budget.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "BUDGET_CATEGORY")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BudgetCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "budget_id", nullable = false)
    private Long budgetId;

    @Column(nullable = false, length = 20)
    private String name;

    @Column(nullable = false)
    private Integer allocated;

    @Column(nullable = false)
    private Integer spent;

    @Builder
    public BudgetCategory(Long budgetId, String name, Integer allocated) {
        this.budgetId = budgetId;
        this.name = name;
        this.allocated = allocated;
        this.spent = 0;
    }

    public void updateAllocated(Integer allocated) {
        this.allocated = allocated;
    }

    public void addSpent(Integer amount) {
        this.spent += amount;
    }
}
