package com.ssafy.sdme.couple.repository;

import com.ssafy.sdme.couple.domain.Couple;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CoupleRepository extends JpaRepository<Couple, Long> {
    List<Couple> findAllByGroomIdOrBrideId(Long groomId, Long brideId);

    default Optional<Couple> findByGroomIdOrBrideId(Long groomId, Long brideId) {
        List<Couple> results = findAllByGroomIdOrBrideId(groomId, brideId);
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }
}
