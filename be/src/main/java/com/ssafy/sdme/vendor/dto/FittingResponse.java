package com.ssafy.sdme.vendor.dto;

public record FittingResponse(
    Long vendorId,
    String vendorName,
    String resultImageBase64
) {}