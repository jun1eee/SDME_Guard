package com.ssafy.sdme.reservation.service;

import com.ssafy.sdme._global.exception.NotFoundException;
import com.ssafy.sdme.reservation.domain.Reservation;
import com.ssafy.sdme.reservation.dto.ReservationRequest;
import com.ssafy.sdme.reservation.repository.ReservationRepository;
import com.ssafy.sdme.user.domain.User;
import com.ssafy.sdme.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReservationService {

    private final ReservationRepository reservationRepository;
    private final UserRepository userRepository;

    @Transactional
    public Reservation createReservation(Long userId, ReservationRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        if (user.getCoupleId() == null) {
            throw new NotFoundException("커플 매칭이 필요합니다.");
        }

        Reservation reservation = Reservation.builder()
                .coupleId(user.getCoupleId())
                .vendorId(request.getVendorId())
                .hallDetailId(request.getHallDetailId() != null ? request.getHallDetailId() : 0L)
                .reservationDate(request.getReservationDate())
                .serviceDate(request.getServiceDate())
                .reservationTime(request.getReservationTime())
                .memo(request.getMemo())
                .build();
        reservationRepository.save(reservation);

        log.info("[Reservation] 예약 생성 - userId: {}, vendorId: {}", userId, request.getVendorId());
        return reservation;
    }

    @Transactional(readOnly = true)
    public List<Reservation> getReservations(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        if (user.getCoupleId() == null) {
            throw new NotFoundException("커플 매칭이 필요합니다.");
        }

        return reservationRepository.findByCoupleIdOrderByCreatedAtDesc(user.getCoupleId());
    }

    @Transactional
    public Reservation updateReservation(Long reservationId, ReservationRequest request) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new NotFoundException("예약을 찾을 수 없습니다."));

        reservation.update(request.getReservationDate(), request.getServiceDate(),
                request.getReservationTime(), request.getMemo());

        log.info("[Reservation] 예약 수정 - reservationId: {}", reservationId);
        return reservation;
    }

    @Transactional
    public void cancelReservation(Long reservationId) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new NotFoundException("예약을 찾을 수 없습니다."));

        reservation.cancel();
        log.info("[Reservation] 예약 취소 - reservationId: {}", reservationId);
    }
}
