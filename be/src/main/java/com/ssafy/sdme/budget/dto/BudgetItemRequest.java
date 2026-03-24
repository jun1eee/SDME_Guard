package com.ssafy.sdme.budget.dto;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class BudgetItemRequest {
    private String category;
    private String name;
    private Long vendorId;
    private Integer amount;
}
