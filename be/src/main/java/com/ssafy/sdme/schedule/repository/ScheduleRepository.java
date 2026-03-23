package com.ssafy.sdme.schedule.repository;

import com.ssafy.sdme.schedule.domain.Schedule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ScheduleRepository extends JpaRepository<Schedule, Long> {
    List<Schedule> findByCoupleIdAndDeletedAtIsNullOrderByDateAscCreatedAtDesc(Long coupleId);
    List<Schedule> findByUserIdAndDeletedAtIsNullOrderByDateAscCreatedAtDesc(Long userId);
    List<Schedule> findByReservationIdAndDeletedAtIsNull(Long reservationId);
}
