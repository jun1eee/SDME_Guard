package com.ssafy.sdme.payment.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "CARD_INFORMATION")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CardInformation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "pg_provider")
    private String pgProvider;

    @Column(name = "customer_key", length = 200)
    private String customerKey;

    @Column(name = "billing_key", length = 200)
    private String billingKey;

    @Column(name = "method_provider", length = 100)
    private String methodProvider;

    @Column(name = "card_brand", length = 100)
    private String cardBrand;

    @Column(name = "card_last4", length = 4)
    private String cardLast4;

    @Column(name = "owner_name", length = 100)
    private String ownerName;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Builder
    public CardInformation(Long userId, String pgProvider, String customerKey, String billingKey,
                           String methodProvider, String cardBrand, String cardLast4, String ownerName) {
        this.userId = userId;
        this.pgProvider = pgProvider;
        this.customerKey = customerKey;
        this.billingKey = billingKey;
        this.methodProvider = methodProvider;
        this.cardBrand = cardBrand;
        this.cardLast4 = cardLast4;
        this.ownerName = ownerName;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public void softDelete() {
        this.deletedAt = LocalDateTime.now();
    }

    public boolean isDeleted() {
        return this.deletedAt != null;
    }
}
