package com.ssafy.sdme.payment.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "PAYMENT")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "couple_id", nullable = false)
    private Long coupleId;

    @Column(name = "vendor_id", nullable = false)
    private Long vendorId;

    @Column(name = "reservation_id", nullable = false)
    private Long reservationId;

    @Column(name = "card_information_id", nullable = false)
    private Long cardInformationId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentType type;

    @Column(nullable = false)
    private Integer amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentStatus status;

    @Column
    private LocalDate date;

    @Column(name = "pg_provider")
    private String pgProvider;

    @Column(name = "payment_key", length = 200)
    private String paymentKey;

    @Column(name = "requested_at", nullable = false)
    private LocalDateTime requestedAt;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Builder
    public Payment(Long coupleId, Long vendorId, Long reservationId, Long cardInformationId,
                   PaymentType type, Integer amount, String pgProvider) {
        this.coupleId = coupleId;
        this.vendorId = vendorId;
        this.reservationId = reservationId;
        this.cardInformationId = cardInformationId;
        this.type = type;
        this.amount = amount;
        this.status = PaymentStatus.READY;
        this.date = LocalDate.now();
        this.pgProvider = pgProvider;
        this.requestedAt = LocalDateTime.now();
    }

    public void approve(String paymentKey) {
        this.paymentKey = paymentKey;
        this.status = PaymentStatus.DONE;
        this.approvedAt = LocalDateTime.now();
    }

    public void fail() {
        this.status = PaymentStatus.ABORTED;
    }

    public void cancel() {
        this.status = PaymentStatus.CANCELED;
    }

    public enum PaymentType {
        DEPOSIT, BALANCE
    }

    public enum PaymentStatus {
        READY, IN_PROGRESS, DONE, CANCELED, PARTIAL_CANCELED, ABORTED, EXPIRED
    }
}
