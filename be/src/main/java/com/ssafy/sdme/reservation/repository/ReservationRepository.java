package com.ssafy.sdme.reservation.repository;

import com.ssafy.sdme.reservation.domain.Reservation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {
    List<Reservation> findByCoupleIdOrderByCreatedAtDesc(Long coupleId);
    List<Reservation> findByVendorIdAndReservationDateAndStatusNot(Long vendorId, LocalDate date, Reservation.ReservationStatus status);
    boolean existsByVendorIdAndReservationDateAndReservationTimeAndStatusNot(Long vendorId, LocalDate date, LocalTime time, Reservation.ReservationStatus status);

    java.util.Optional<Reservation> findTopByCoupleIdAndVendorIdAndStatusNotOrderByCreatedAtDesc(Long coupleId, Long vendorId, Reservation.ReservationStatus status);
}
