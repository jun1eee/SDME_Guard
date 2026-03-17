package com.ssafy.sdme.vendor.domain;

import com.ssafy.sdme._global.common.entity.BaseIdEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "VENDOR_PACKAGE")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VendorPackage extends BaseIdEntity {

    @Column(nullable = false)
    private Long vendorId;

    @Column(nullable = false, length = 100)
    private String tabName;

    @Column
    private Long price;

    @Builder
    private VendorPackage(Long vendorId, String tabName, Long price) {
        this.vendorId = vendorId;
        this.tabName = tabName;
        this.price = price;
    }
}
