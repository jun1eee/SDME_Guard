package com.ssafy.sdme.payment.repository;

import com.ssafy.sdme.payment.domain.CardInformation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CardInformationRepository extends JpaRepository<CardInformation, Long> {
    List<CardInformation> findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long userId);
    Optional<CardInformation> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);
    Optional<CardInformation> findByUserIdAndCustomerKeyAndDeletedAtIsNull(Long userId, String customerKey);
}
