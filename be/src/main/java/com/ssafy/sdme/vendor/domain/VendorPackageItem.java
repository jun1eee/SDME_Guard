package com.ssafy.sdme.vendor.domain;

import com.ssafy.sdme._global.common.entity.BaseIdEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "VENDOR_PACKAGE_ITEM")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VendorPackageItem extends BaseIdEntity {

    @Column(nullable = false)
    private Long packageId;

    @Column(length = 100)
    private String label;

    @Column(length = 200)
    private String value;

    @Builder
    private VendorPackageItem(Long packageId, String label, String value) {
        this.packageId = packageId;
        this.label = label;
        this.value = value;
    }
}
