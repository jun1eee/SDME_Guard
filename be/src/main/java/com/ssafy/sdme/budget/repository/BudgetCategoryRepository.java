package com.ssafy.sdme.budget.repository;

import com.ssafy.sdme.budget.domain.BudgetCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BudgetCategoryRepository extends JpaRepository<BudgetCategory, Long> {
    List<BudgetCategory> findByBudgetIdOrderByIdAsc(Long budgetId);
}
