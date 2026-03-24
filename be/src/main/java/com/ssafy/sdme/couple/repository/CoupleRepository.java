package com.ssafy.sdme.couple.repository;

import com.ssafy.sdme.couple.domain.Couple;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CoupleRepository extends JpaRepository<Couple, Long> {
    Optional<Couple> findByGroomIdOrBrideId(Long groomId, Long brideId);
}
