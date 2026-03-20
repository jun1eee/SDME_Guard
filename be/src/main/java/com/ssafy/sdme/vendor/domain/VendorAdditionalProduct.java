package com.ssafy.sdme.vendor.domain;

import com.ssafy.sdme._global.common.entity.BaseIdEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "VENDOR_ADDITIONAL_PRODUCT")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VendorAdditionalProduct extends BaseIdEntity {

    @Column(nullable = false)
    private Long vendorId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 50)
    private String price;

    @Builder
    private VendorAdditionalProduct(Long vendorId, String name, String price) {
        this.vendorId = vendorId;
        this.name = name;
        this.price = price;
    }
}
