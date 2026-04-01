package com.ssafy.sdme.vendor.domain;

import com.ssafy.sdme._global.common.entity.BaseIdEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "VENDOR_HALL_DETAIL")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VendorHallDetail extends BaseIdEntity {

    @Column(nullable = false)
    private Long vendorId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column
    private Integer guestMin;

    @Column
    private Integer guestMax;

    @Column(length = 30)
    private String hallType;

    @Column(length = 10)
    private String style;

    @Column(length = 10)
    private String mealType;

    @Column
    private Integer mealPrice;

    @Column
    private Integer rentalPrice;

    @Column(length = 10)
    private String ceremonyType;

    @Column
    private Integer ceremonyIntervalMin;

    @Column
    private Integer ceremonyIntervalMax;

    @Column(length = 20)
    private String entranceType;

    @Column(nullable = false)
    private boolean hasSubway;

    @Column(nullable = false)
    private boolean hasParking;

    @Column(nullable = false)
    private boolean hasValet;

    @Column(nullable = false)
    private boolean hasVirginRoad;

    public static VendorHallDetail withRentalPrice(VendorHallDetail h, Integer rentalPrice) {
        return VendorHallDetail.builder()
            .vendorId(h.getVendorId())
            .name(h.getName())
            .guestMin(h.getGuestMin())
            .guestMax(h.getGuestMax())
            .hallType(h.getHallType())
            .style(h.getStyle())
            .mealType(h.getMealType())
            .mealPrice(h.getMealPrice())
            .rentalPrice(rentalPrice)
            .ceremonyType(h.getCeremonyType())
            .ceremonyIntervalMin(h.getCeremonyIntervalMin())
            .ceremonyIntervalMax(h.getCeremonyIntervalMax())
            .entranceType(h.getEntranceType())
            .hasSubway(h.isHasSubway())
            .hasParking(h.isHasParking())
            .hasValet(h.isHasValet())
            .hasVirginRoad(h.isHasVirginRoad())
            .build();
    }

    @Builder
    private VendorHallDetail(
        Long vendorId, String name,
        Integer guestMin, Integer guestMax,
        String hallType, String style,
        String mealType, Integer mealPrice, Integer rentalPrice,
        String ceremonyType, Integer ceremonyIntervalMin, Integer ceremonyIntervalMax,
        String entranceType,
        boolean hasSubway, boolean hasParking, boolean hasValet, boolean hasVirginRoad
    ) {
        this.vendorId    = vendorId;
        this.name        = name;
        this.guestMin    = guestMin;
        this.guestMax    = guestMax;
        this.hallType    = hallType;
        this.style       = style;
        this.mealType    = mealType;
        this.mealPrice   = mealPrice;
        this.rentalPrice = rentalPrice;
        this.ceremonyType = ceremonyType;
        this.ceremonyIntervalMin = ceremonyIntervalMin;
        this.ceremonyIntervalMax = ceremonyIntervalMax;
        this.entranceType = entranceType;
        this.hasSubway   = hasSubway;
        this.hasParking  = hasParking;
        this.hasValet    = hasValet;
        this.hasVirginRoad = hasVirginRoad;
    }
}
