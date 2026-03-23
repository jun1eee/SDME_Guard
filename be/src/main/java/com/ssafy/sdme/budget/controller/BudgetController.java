package com.ssafy.sdme.budget.controller;

import com.ssafy.sdme._global.ApiResponse;
import com.ssafy.sdme._global.common.constant.ApiPath;
import com.ssafy.sdme.budget.dto.*;
import com.ssafy.sdme.budget.service.BudgetService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Budget", description = "예산 관리 API")
@RestController
@RequestMapping(ApiPath.PATH + "/budgets")
@RequiredArgsConstructor
public class BudgetController {

    private final BudgetService budgetService;

    @Operation(summary = "예산 전체 조회", description = "커플의 예산 정보를 조회합니다.")
    @GetMapping
    public ApiResponse<BudgetResponse> getBudget(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        return ApiResponse.ok(budgetService.getBudget(userId));
    }

    @Operation(summary = "총 예산 수정", description = "총 예산 금액을 수정합니다.")
    @PutMapping("/total")
    public ApiResponse<BudgetResponse> updateTotal(@RequestBody BudgetTotalRequest budgetRequest,
                                                    HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        return ApiResponse.ok(budgetService.updateTotal(userId, budgetRequest));
    }

    @Operation(summary = "예산 항목 추가", description = "카테고리에 예산 항목을 추가합니다.")
    @PostMapping("/category/items")
    public ApiResponse<BudgetResponse> addItem(@RequestBody BudgetItemRequest itemRequest,
                                                HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        return ApiResponse.ok(budgetService.addItem(userId, itemRequest));
    }

    @Operation(summary = "예산 항목 수정", description = "예산 항목을 수정합니다.")
    @PutMapping("/category/{itemId}")
    public ApiResponse<BudgetResponse> updateItem(@PathVariable Long itemId,
                                                   @RequestBody BudgetCategoryUpdateRequest updateRequest,
                                                   HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        return ApiResponse.ok(budgetService.updateItem(userId, itemId, updateRequest));
    }

    @Operation(summary = "예산 항목 삭제", description = "예산 항목을 삭제합니다.")
    @DeleteMapping("/category/{itemId}")
    public ApiResponse<BudgetResponse> deleteItem(@PathVariable Long itemId,
                                                   HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        return ApiResponse.ok(budgetService.deleteItem(userId, itemId));
    }
}
