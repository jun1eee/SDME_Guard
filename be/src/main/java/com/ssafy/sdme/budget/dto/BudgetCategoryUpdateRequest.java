package com.ssafy.sdme.budget.dto;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BudgetCategoryUpdateRequest {
    private String name;
    private Integer amount;
}
