package com.ssafy.sdme.reservation.repository;

import com.ssafy.sdme.reservation.domain.Reservation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {
    List<Reservation> findByCoupleIdOrderByCreatedAtDesc(Long coupleId);

    boolean existsByCoupleIdAndVendorIdAndStatusNot(Long coupleId, Long vendorId, Reservation.ReservationStatus status);

    java.util.Optional<Reservation> findTopByCoupleIdAndVendorIdAndStatusNotOrderByCreatedAtDesc(Long coupleId, Long vendorId, Reservation.ReservationStatus status);
}
