package com.ssafy.sdme.payment.dto;

import com.ssafy.sdme.payment.domain.Payment;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class PaymentResponse {
    private Long id;
    private Long vendorId;
    private String vendorName;
    private String vendorCategory;
    private String vendorImage;
    private Long reservationId;
    private String type;
    private Integer amount;
    private String status;
    private String paymentKey;
    private String cardBrand;
    private String cardLast4;
    private LocalDateTime requestedAt;
    private LocalDateTime approvedAt;

    public static PaymentResponse of(Payment payment, String cardBrand, String cardLast4,
                                     String vendorName, String vendorCategory, String vendorImage) {
        return PaymentResponse.builder()
                .id(payment.getId())
                .vendorId(payment.getVendorId())
                .vendorName(vendorName)
                .vendorCategory(vendorCategory)
                .vendorImage(vendorImage)
                .reservationId(payment.getReservationId())
                .type(payment.getType().name())
                .amount(payment.getAmount())
                .status(payment.getStatus().name())
                .paymentKey(payment.getPaymentKey())
                .cardBrand(cardBrand)
                .cardLast4(cardLast4)
                .requestedAt(payment.getRequestedAt())
                .approvedAt(payment.getApprovedAt())
                .build();
    }
}
