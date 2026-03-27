package com.ssafy.sdme.payment.service;

import com.ssafy.sdme._global.exception.BadRequestException;
import com.ssafy.sdme._global.exception.NotFoundException;
import com.ssafy.sdme.budget.dto.BudgetItemRequest;
import com.ssafy.sdme.budget.service.BudgetService;
import com.ssafy.sdme.payment.domain.CardInformation;
import com.ssafy.sdme.payment.domain.Payment;
import com.ssafy.sdme.payment.dto.PaymentRequest;
import com.ssafy.sdme.payment.dto.PaymentResponse;
import com.ssafy.sdme.payment.repository.CardInformationRepository;
import com.ssafy.sdme.payment.repository.PaymentRepository;
import com.ssafy.sdme.reservation.domain.Reservation;
import com.ssafy.sdme.reservation.repository.ReservationRepository;
import com.ssafy.sdme.user.domain.User;
import com.ssafy.sdme.user.repository.UserRepository;
import com.ssafy.sdme.vendor.domain.Vendor;
import com.ssafy.sdme.vendor.repository.VendorRepository;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final CardInformationRepository cardRepository;
    private final ReservationRepository reservationRepository;
    private final UserRepository userRepository;
    private final VendorRepository vendorRepository;
    private final TossPaymentService tossPaymentService;
    private final BudgetService budgetService;

    @Transactional
    public PaymentResponse processPayment(Long userId, PaymentRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        if (user.getCoupleId() == null) {
            throw new BadRequestException("커플 매칭이 필요합니다.");
        }

        Reservation reservation = reservationRepository.findById(request.getReservationId())
                .orElseThrow(() -> new NotFoundException("예약을 찾을 수 없습니다."));

        CardInformation card = cardRepository.findByIdAndUserIdAndDeletedAtIsNull(request.getCardId(), userId)
                .orElseThrow(() -> new NotFoundException("카드를 찾을 수 없습니다."));

        Vendor vendor = vendorRepository.findById(reservation.getVendorId())
                .orElseThrow(() -> new NotFoundException("업체를 찾을 수 없습니다."));

        Payment.PaymentType type = Payment.PaymentType.valueOf(request.getType());

        // 잔금 결제는 서비스 시간 이후에만 가능
        if (type == Payment.PaymentType.BALANCE
                && reservation.getServiceDate() != null
                && reservation.getReservationTime() != null) {
            LocalDateTime serviceDateTime = LocalDateTime.of(reservation.getServiceDate(), reservation.getReservationTime());
            if (LocalDateTime.now().isBefore(serviceDateTime)) {
                throw new BadRequestException("잔금 결제는 서비스 시간(" + reservation.getServiceDate() + " " + reservation.getReservationTime() + ") 이후에 가능합니다.");
            }
        }

        String orderId = "ORDER_" + reservation.getId() + "_" + type.name() + "_" + System.currentTimeMillis();
        String orderName = vendor.getName() + " " + (type == Payment.PaymentType.DEPOSIT ? "계약금" : "잔금");

        Payment payment = Payment.builder()
                .coupleId(user.getCoupleId())
                .vendorId(reservation.getVendorId())
                .reservationId(reservation.getId())
                .cardInformationId(card.getId())
                .type(type)
                .amount(request.getAmount())
                .pgProvider("toss_payments")
                .build();

        paymentRepository.save(payment);

        try {
            Map<String, Object> result = tossPaymentService.requestPayment(
                    card.getBillingKey(), card.getCustomerKey(),
                    orderId, request.getAmount(), orderName
            );

            String paymentKey = (String) result.get("paymentKey");
            payment.approve(paymentKey);

            // 예약 진행상태 업데이트
            if (type == Payment.PaymentType.DEPOSIT) {
                reservation.updateProgress(Reservation.ReservationProgress.DEPOSIT_PAID);
                reservation.confirm();
            } else {
                reservation.updateProgress(Reservation.ReservationProgress.BALANCE_PAID);
            }

            log.info("[Payment] 결제 성공 - orderId: {}, amount: {}, paymentKey: {}", orderId, request.getAmount(), paymentKey);

            // 계약금 결제 → 예산 항목 미확정으로 추가 / 잔금 결제 → 기존 항목 확정 처리
            if (type == Payment.PaymentType.DEPOSIT) {
                try {
                    String budgetCategory = mapBudgetCategory(vendor.getCategory());
                    int totalAmount = request.getAmount() * 10; // 계약금 10% → 총액 역산
                    budgetService.addItem(userId, new BudgetItemRequest(budgetCategory, vendor.getName(), vendor.getId(), totalAmount));
                    log.info("[Payment] 예산 항목 추가 (미확정) - vendor: {}, amount: {}", vendor.getName(), totalAmount);
                } catch (Exception ex) {
                    log.warn("[Payment] 예산 항목 추가 실패 - {}", ex.getMessage());
                }
            } else if (type == Payment.PaymentType.BALANCE) {
                try {
                    budgetService.markVendorItemPaid(userId, vendor.getId());
                    log.info("[Payment] 예산 항목 확정 처리 - vendorId: {}", vendor.getId());
                } catch (Exception ex) {
                    log.warn("[Payment] 예산 항목 확정 처리 실패 - {}", ex.getMessage());
                }
            }
        } catch (Exception e) {
            payment.fail();
            log.error("[Payment] 결제 실패 - orderId: {}, error: {}", orderId, e.getMessage());
            throw new BadRequestException("결제에 실패했습니다: " + e.getMessage());
        }

        return PaymentResponse.of(payment, card.getCardBrand(), card.getCardLast4(),
                vendor.getName(), vendor.getCategory(), vendor.getImageUrl());
    }

    @Transactional(readOnly = true)
    public List<PaymentResponse> getPayments(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        if (user.getCoupleId() == null) {
            throw new BadRequestException("커플 매칭이 필요합니다.");
        }

        List<Payment> payments = paymentRepository.findByCoupleIdOrderByRequestedAtDesc(user.getCoupleId());
        List<Long> vendorIds = payments.stream().map(Payment::getVendorId).distinct().toList();
        Map<Long, Vendor> vendorMap = vendorRepository.findAllById(vendorIds).stream()
                .collect(Collectors.toMap(Vendor::getId, v -> v));

        return payments.stream().map(p -> {
            CardInformation card = cardRepository.findById(p.getCardInformationId()).orElse(null);
            Vendor v = vendorMap.get(p.getVendorId());
            return PaymentResponse.of(p,
                    card != null ? card.getCardBrand() : null,
                    card != null ? card.getCardLast4() : null,
                    v != null ? v.getName() : null,
                    v != null ? v.getCategory() : null,
                    v != null ? v.getImageUrl() : null);
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<PaymentResponse> getVendorPayments(Long userId, Long vendorId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        if (user.getCoupleId() == null) {
            throw new BadRequestException("커플 매칭이 필요합니다.");
        }

        List<Payment> payments = paymentRepository.findByCoupleIdAndVendorIdOrderByRequestedAtDesc(user.getCoupleId(), vendorId);
        Vendor vendor = vendorRepository.findById(vendorId).orElse(null);
        return payments.stream().map(p -> {
            CardInformation card = cardRepository.findById(p.getCardInformationId()).orElse(null);
            return PaymentResponse.of(p,
                    card != null ? card.getCardBrand() : null,
                    card != null ? card.getCardLast4() : null,
                    vendor != null ? vendor.getName() : null,
                    vendor != null ? vendor.getCategory() : null,
                    vendor != null ? vendor.getImageUrl() : null);
        }).toList();
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
}
