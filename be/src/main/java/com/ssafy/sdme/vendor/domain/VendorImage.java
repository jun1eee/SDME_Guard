package com.ssafy.sdme.vendor.domain;

import com.ssafy.sdme._global.common.entity.BaseIdEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "VENDOR_IMAGE")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VendorImage extends BaseIdEntity {

    @Column(nullable = false)
    private Long vendorId;

    @Column(nullable = false, length = 500)
    private String imageUrl;

    @Column(nullable = false)
    private Integer orderNum;

    @Builder
    private VendorImage(Long vendorId, String imageUrl, Integer orderNum) {
        this.vendorId = vendorId;
        this.imageUrl = imageUrl;
        this.orderNum = orderNum;
    }
}
