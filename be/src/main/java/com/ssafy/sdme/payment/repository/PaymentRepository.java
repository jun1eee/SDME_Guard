package com.ssafy.sdme.payment.repository;

import com.ssafy.sdme.payment.domain.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findByCoupleIdOrderByRequestedAtDesc(Long coupleId);
    List<Payment> findByReservationIdOrderByRequestedAtDesc(Long reservationId);
    List<Payment> findByCoupleIdAndVendorIdOrderByRequestedAtDesc(Long coupleId, Long vendorId);
}
