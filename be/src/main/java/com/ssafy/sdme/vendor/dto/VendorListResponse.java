package com.ssafy.sdme.vendor.dto;

import java.util.List;

public record VendorListResponse(
    List<VendorSummary> items,
    String nextCursor
) {}
