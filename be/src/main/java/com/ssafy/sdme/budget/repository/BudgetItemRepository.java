package com.ssafy.sdme.budget.repository;

import com.ssafy.sdme.budget.domain.BudgetItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BudgetItemRepository extends JpaRepository<BudgetItem, Long> {
    List<BudgetItem> findByBudgetCategoryIdOrderByCreatedAtDesc(Long budgetCategoryId);
    List<BudgetItem> findByBudgetCategoryIdInOrderByCreatedAtDesc(List<Long> budgetCategoryIds);
}
