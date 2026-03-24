package com.ssafy.sdme.reservation.service;

import com.ssafy.sdme._global.exception.BadRequestException;
import com.ssafy.sdme._global.exception.NotFoundException;
import com.ssafy.sdme.budget.dto.BudgetItemRequest;
import com.ssafy.sdme.budget.service.BudgetService;
import com.ssafy.sdme.payment.domain.Payment;
import com.ssafy.sdme.payment.repository.PaymentRepository;
import com.ssafy.sdme.reservation.domain.Reservation;
import com.ssafy.sdme.schedule.repository.ScheduleRepository;
import com.ssafy.sdme.reservation.dto.ReservationRequest;
import com.ssafy.sdme.reservation.dto.ReservationResponse;
import com.ssafy.sdme.reservation.repository.ReservationRepository;
import com.ssafy.sdme.schedule.domain.Schedule;
import com.ssafy.sdme.schedule.dto.ScheduleRequest;
import com.ssafy.sdme.schedule.service.ScheduleService;
import com.ssafy.sdme.user.domain.User;
import com.ssafy.sdme.user.repository.UserRepository;
import com.ssafy.sdme.vendor.domain.Vendor;
import com.ssafy.sdme.vendor.repository.VendorRepository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
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
    private final VendorRepository vendorRepository;
    private final PaymentRepository paymentRepository;
    private final ScheduleService scheduleService;
    private final ScheduleRepository scheduleRepository;
    private final BudgetService budgetService;

    @Transactional
    public Reservation createReservation(Long userId, ReservationRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        if (user.getCoupleId() == null) {
            throw new NotFoundException("커플 매칭이 필요합니다.");
        }

        // 중복 예약 체크
        if (request.getReservationDate() != null && request.getReservationTime() != null) {
            boolean exists = reservationRepository.existsByVendorIdAndReservationDateAndReservationTimeAndStatusNot(
                    request.getVendorId(), request.getReservationDate(), request.getReservationTime(),
                    Reservation.ReservationStatus.CANCELLED);
            if (exists) {
                throw new BadRequestException("이미 예약된 시간입니다.");
            }
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

        // 일정 자동 추가 (reservationId 연결)
        try {
            Vendor vendor = vendorRepository.findById(request.getVendorId()).orElse(null);
            if (vendor != null && request.getReservationDate() != null) {
                scheduleService.createScheduleWithReservation(userId, vendor.getName() + " 방문",
                        request.getReservationDate(), request.getReservationTime(),
                        request.getMemo(), mapCategory(vendor.getCategory()), reservation.getId());
                log.info("[Reservation] 일정 자동 추가 - vendorName: {}, date: {}, reservationId: {}",
                        vendor.getName(), request.getReservationDate(), reservation.getId());
            }
        } catch (Exception e) {
            log.warn("[Reservation] 일정 자동 추가 실패 - {}", e.getMessage());
        }


        log.info("[Reservation] 예약 생성 - userId: {}, vendorId: {}", userId, request.getVendorId());
        return reservation;
    }

    @Transactional(readOnly = true)
    public List<ReservationResponse> getReservations(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        if (user.getCoupleId() == null) {
            throw new NotFoundException("커플 매칭이 필요합니다.");
        }

        List<Reservation> reservations = reservationRepository.findByCoupleIdOrderByCreatedAtDesc(user.getCoupleId());

        List<Long> vendorIds = reservations.stream().map(Reservation::getVendorId).distinct().toList();
        Map<Long, Vendor> vendorMap = vendorRepository.findAllById(vendorIds).stream()
                .collect(Collectors.toMap(Vendor::getId, Function.identity()));

        return reservations.stream()
                .map(r -> ReservationResponse.of(r, vendorMap.get(r.getVendorId())))
                .toList();
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

        // 해당 예약의 결제도 같이 취소
        List<Payment> payments = paymentRepository.findByReservationIdOrderByRequestedAtDesc(reservationId);
        for (Payment payment : payments) {
            if (payment.getStatus() == Payment.PaymentStatus.DONE) {
                payment.cancel();
            }
        }

        // 연결된 일정도 같이 삭제
        scheduleRepository.findByReservationIdAndDeletedAtIsNull(reservationId)
                .forEach(schedule -> {
                    schedule.delete();
                    log.info("[Reservation] 연결된 일정 삭제 - scheduleId: {}", schedule.getId());
                });

        log.info("[Reservation] 예약/결제/일정 취소 - reservationId: {}, 취소된 결제: {}건", reservationId, payments.size());
    }

    @Transactional(readOnly = true)
    public List<String> getBookedTimes(Long vendorId, LocalDate date) {
        return reservationRepository.findByVendorIdAndReservationDateAndStatusNot(
                vendorId, date, Reservation.ReservationStatus.CANCELLED)
                .stream()
                .map(r -> r.getReservationTime() != null ? r.getReservationTime().toString().substring(0, 5) : "")
                .filter(t -> !t.isEmpty())
                .toList();
    }

    private String mapBudgetCategory(String vendorCategory) {
        if (vendorCategory == null) return "웨딩홀";
        return switch (vendorCategory.toUpperCase()) {
            case "STUDIO" -> "스튜디오";
            case "DRESS" -> "드레스";
            case "MAKEUP" -> "메이크업";
            default -> "웨딩홀";
        };
    }

    private Schedule.ScheduleCategory mapCategory(String vendorCategory) {
        if (vendorCategory == null) return Schedule.ScheduleCategory.HALL;
        return switch (vendorCategory.toUpperCase()) {
            case "STUDIO" -> Schedule.ScheduleCategory.STUDIO;
            case "DRESS" -> Schedule.ScheduleCategory.DRESS;
            case "MAKEUP" -> Schedule.ScheduleCategory.MAKEUP;
            default -> Schedule.ScheduleCategory.HALL;
        };
    }
}
