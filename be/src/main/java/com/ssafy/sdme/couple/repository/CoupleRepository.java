package com.ssafy.sdme.couple.repository;

import com.ssafy.sdme.couple.domain.Couple;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoupleRepository extends JpaRepository<Couple, Long> {
}
