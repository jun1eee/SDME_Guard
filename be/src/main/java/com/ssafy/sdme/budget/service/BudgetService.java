package com.ssafy.sdme.budget.service;

import com.ssafy.sdme._global.exception.BadRequestException;
import com.ssafy.sdme._global.exception.NotFoundException;
import com.ssafy.sdme.budget.domain.Budget;
import com.ssafy.sdme.budget.domain.BudgetCategory;
import com.ssafy.sdme.budget.domain.BudgetItem;
import com.ssafy.sdme.budget.dto.*;
import com.ssafy.sdme.budget.repository.BudgetCategoryRepository;
import com.ssafy.sdme.budget.repository.BudgetItemRepository;
import com.ssafy.sdme.budget.repository.BudgetRepository;
import com.ssafy.sdme.couple.domain.Couple;
import com.ssafy.sdme.couple.repository.CoupleRepository;
import com.ssafy.sdme.user.domain.Role;
import com.ssafy.sdme.user.domain.User;
import com.ssafy.sdme.user.domain.UserPreference;
import com.ssafy.sdme.user.repository.UserPreferenceRepository;
import com.ssafy.sdme.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class BudgetService {

    private final BudgetRepository budgetRepository;
    private final BudgetCategoryRepository categoryRepository;
    private final BudgetItemRepository itemRepository;
    private final UserRepository userRepository;
    private final UserPreferenceRepository userPreferenceRepository;
    private final CoupleRepository coupleRepository;

    private static final List<String> DEFAULT_CATEGORIES = List.of("웨딩홀", "스튜디오", "드레스", "메이크업", "허니문", "기타");

    @Transactional(readOnly = true)
    public BudgetResponse getBudget(Long userId) {
        User user = getUser(userId);
        Budget budget = getOrCreateBudget(user.getCoupleId(), user);

        List<BudgetCategory> categories = categoryRepository.findByBudgetIdOrderByIdAsc(budget.getId());
        List<Long> categoryIds = categories.stream().map(BudgetCategory::getId).toList();
        List<BudgetItem> allItems = categoryIds.isEmpty()
                ? List.of()
                : itemRepository.findByBudgetCategoryIdInOrderByCreatedAtDesc(categoryIds);

        int totalSpent = categories.stream().mapToInt(BudgetCategory::getSpent).sum();

        List<BudgetResponse.CategoryResponse> categoryResponses = categories.stream().map(cat -> {
            List<BudgetResponse.ItemResponse> items = allItems.stream()
                    .filter(item -> item.getBudgetCategoryId().equals(cat.getId()))
                    .map(item -> BudgetResponse.ItemResponse.builder()
                            .id(item.getId())
                            .name(item.getName())
                            .vendorId(item.getVendorId())
                            .amount(item.getAmount())
                            .isPaid(item.getIsPaid())
                            .build())
                    .toList();

            return BudgetResponse.CategoryResponse.builder()
                    .id(cat.getId())
                    .name(cat.getName())
                    .allocated(cat.getAllocated())
                    .spent(cat.getSpent())
                    .remaining(cat.getAllocated() - cat.getSpent())
                    .items(items)
                    .build();
        }).toList();

        return BudgetResponse.builder()
                .id(budget.getId())
                .totalBudget(budget.getTotalBudget())
                .totalSpent(totalSpent)
                .totalRemaining(budget.getTotalBudget() - totalSpent)
                .categories(categoryResponses)
                .build();
    }

    @Transactional
    public BudgetResponse updateTotal(Long userId, BudgetTotalRequest request) {
        User user = getUser(userId);
        Budget budget = getOrCreateBudget(user.getCoupleId(), user);
        budget.updateTotal(request.getTotalBudget());

        // UserPreference도 동기화 (만원 단위로 저장)
        int prefBudget = request.getTotalBudget() / 10000;
        userPreferenceRepository.findByUserId(userId).ifPresent(pref ->
            pref.updateSharedInfo(pref.getWeddingDate(), prefBudget, pref.getGuestCount(), pref.getPreferredRegions())
        );
        // 파트너도 동기화
        Long partnerId = findPartnerId(user);
        if (partnerId != null) {
            userPreferenceRepository.findByUserId(partnerId).ifPresent(pref ->
                pref.updateSharedInfo(pref.getWeddingDate(), prefBudget, pref.getGuestCount(), pref.getPreferredRegions())
            );
        }

        log.info("[Budget] 총 예산 수정 + UserPreference 동기화 - coupleId: {}, total: {}", user.getCoupleId(), request.getTotalBudget());
        return getBudget(userId);
    }

    private Long findPartnerId(User user) {
        if (user.getCoupleId() == null) return null;
        return coupleRepository.findById(user.getCoupleId())
                .map(couple -> user.getRole() == Role.g ? couple.getBrideId() : couple.getGroomId())
                .orElse(null);
    }

    @Transactional
    public BudgetResponse addItem(Long userId, BudgetItemRequest request) {
        User user = getUser(userId);
        Budget budget = getOrCreateBudget(user.getCoupleId(), user);

        // 카테고리 찾기 (없으면 생성)
        List<BudgetCategory> categories = categoryRepository.findByBudgetIdOrderByIdAsc(budget.getId());
        BudgetCategory category = categories.stream()
                .filter(c -> c.getName().equals(request.getCategory()))
                .findFirst()
                .orElseGet(() -> categoryRepository.save(
                        BudgetCategory.builder()
                                .budgetId(budget.getId())
                                .name(request.getCategory())
                                .allocated(0)
                                .build()
                ));

        BudgetItem item = BudgetItem.builder()
                .budgetCategoryId(category.getId())
                .vendorId(request.getVendorId() != null ? request.getVendorId() : 0L)
                .name(request.getName())
                .amount(request.getAmount())
                .build();
        itemRepository.save(item);

        log.info("[Budget] 항목 추가 - category: {}, name: {}, amount: {}", request.getCategory(), request.getName(), request.getAmount());
        return getBudget(userId);
    }

    @Transactional
    public BudgetResponse updateItem(Long userId, Long itemId, BudgetCategoryUpdateRequest request) {
        BudgetItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new NotFoundException("예산 항목을 찾을 수 없습니다."));
        item.update(request.getName(), request.getAmount());
        log.info("[Budget] 항목 수정 - itemId: {}", itemId);
        return getBudget(userId);
    }

    @Transactional
    public BudgetResponse deleteItem(Long userId, Long itemId) {
        BudgetItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new NotFoundException("예산 항목을 찾을 수 없습니다."));
        itemRepository.delete(item);
        log.info("[Budget] 항목 삭제 - itemId: {}", itemId);
        return getBudget(userId);
    }

    private User getUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));
        if (user.getCoupleId() == null) {
            throw new BadRequestException("커플 매칭이 필요합니다.");
        }
        return user;
    }

    private Budget getOrCreateBudget(Long coupleId, User user) {
        return budgetRepository.findByCoupleId(coupleId)
                .orElseGet(() -> {
                    // UserPreference에서 총 예산 가져오기
                    Integer totalBudget = userPreferenceRepository.findByUserId(user.getId())
                            .map(pref -> pref.getTotalBudget() != null ? pref.getTotalBudget() * 10000 : 0)
                            .orElse(0);

                    Budget newBudget = budgetRepository.save(
                            Budget.builder().coupleId(coupleId).totalBudget(totalBudget).build()
                    );

                    // 기본 카테고리 생성
                    for (String cat : DEFAULT_CATEGORIES) {
                        categoryRepository.save(
                                BudgetCategory.builder()
                                        .budgetId(newBudget.getId())
                                        .name(cat)
                                        .allocated(0)
                                        .build()
                        );
                    }

                    return newBudget;
                });
    }
}
