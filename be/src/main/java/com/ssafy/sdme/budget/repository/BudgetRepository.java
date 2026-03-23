package com.ssafy.sdme.budget.repository;

import com.ssafy.sdme.budget.domain.Budget;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BudgetRepository extends JpaRepository<Budget, Long> {
    Optional<Budget> findByCoupleId(Long coupleId);
}
