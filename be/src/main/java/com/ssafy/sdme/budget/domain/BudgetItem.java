package com.ssafy.sdme.budget.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "BUDGET_ITEM")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BudgetItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "budget_category_id", nullable = false)
    private Long budgetCategoryId;

    @Column(name = "vendor_id", nullable = false)
    private Long vendorId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false)
    private Integer amount;

    @Column(name = "is_paid", nullable = false)
    private Boolean isPaid;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    public BudgetItem(Long budgetCategoryId, Long vendorId, String name, Integer amount) {
        this.budgetCategoryId = budgetCategoryId;
        this.vendorId = vendorId;
        this.name = name;
        this.amount = amount;
        this.isPaid = false;
        this.createdAt = LocalDateTime.now();
    }

    public void update(String name, Integer amount) {
        if (name != null) this.name = name;
        if (amount != null) this.amount = amount;
        this.updatedAt = LocalDateTime.now();
    }

    public void markPaid() {
        this.isPaid = true;
        this.updatedAt = LocalDateTime.now();
    }
}
