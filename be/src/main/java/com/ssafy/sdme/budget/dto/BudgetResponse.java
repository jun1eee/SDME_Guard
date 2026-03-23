package com.ssafy.sdme.budget.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class BudgetResponse {
    private Long id;
    private Integer totalBudget;
    private Integer totalSpent;
    private Integer totalRemaining;
    private List<CategoryResponse> categories;

    @Getter
    @Builder
    public static class CategoryResponse {
        private Long id;
        private String name;
        private Integer allocated;
        private Integer spent;
        private Integer remaining;
        private List<ItemResponse> items;
    }

    @Getter
    @Builder
    public static class ItemResponse {
        private Long id;
        private String name;
        private Long vendorId;
        private Integer amount;
        private Boolean isPaid;
    }
}
