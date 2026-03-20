package com.ssafy.sdme.vote.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "VOTE_ITEMS")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VoteItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "vendor_id", nullable = false)
    private Long vendorId;

    @Column(name = "shared_vendor_id", nullable = false)
    private Long sharedVendorId;

    @Column(name = "couple_id", nullable = false)
    private Long coupleId;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type")
    private SourceType sourceType;

    @Column(name = "is_active")
    private Boolean isActive;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "created_by_user_id")
    private Long createdByUserId;

    @Builder
    public VoteItem(Long vendorId, Long sharedVendorId, Long coupleId, SourceType sourceType, Long createdByUserId) {
        this.vendorId = vendorId;
        this.sharedVendorId = sharedVendorId;
        this.coupleId = coupleId;
        this.sourceType = sourceType;
        this.isActive = true;
        this.createdAt = LocalDateTime.now();
        this.createdByUserId = createdByUserId;
    }

    public void deactivate() {
        this.isActive = false;
        this.deletedAt = LocalDateTime.now();
    }

    public enum SourceType {
        ai, my_wish, partner_share
    }
}
