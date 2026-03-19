package com.ssafy.sdme.vote.dto;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VoteItemRequest {
    private Long vendorId;
    private Long sharedVendorId;
    private String sourceType; // ai, my_wish, partner_share
}
