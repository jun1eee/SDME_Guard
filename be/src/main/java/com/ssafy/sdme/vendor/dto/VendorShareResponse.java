package com.ssafy.sdme.vendor.dto;

import com.ssafy.sdme.vendor.domain.VendorShare;
import com.ssafy.sdme.vendor.domain.Vendor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class VendorShareResponse {
    private final Long id;
    private final Long vendorId;
    private final String vendorName;
    private final String category;
    private final Long price;
    private final Double rating;
    private final String imageUrl;
    private final Long sharedUserId;
    private final String message;
    private final LocalDateTime sharedAt;

    private VendorShareResponse(VendorShare share, Vendor vendor) {
        this.id = share.getId();
        this.vendorId = share.getVendorId();
        this.vendorName = vendor != null ? vendor.getName() : null;
        this.category = vendor != null ? vendor.getCategory() : null;
        this.price = vendor != null ? vendor.getPrice() : null;
        this.rating = vendor != null ? vendor.getRating() : null;
        this.imageUrl = vendor != null ? vendor.getImageUrl() : null;
        this.sharedUserId = share.getSharedUserId();
        this.message = share.getMessage();
        this.sharedAt = share.getSharedAt();
    }

    public static VendorShareResponse of(VendorShare share, Vendor vendor) {
        return new VendorShareResponse(share, vendor);
    }
}
