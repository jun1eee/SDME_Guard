package com.ssafy.sdme.vendor.controller;

import com.ssafy.sdme._global.ApiResponse;
import com.ssafy.sdme._global.common.constant.ApiPath;
import com.ssafy.sdme.vendor.application.VendorQueryService;
import com.ssafy.sdme.vendor.dto.VendorDetailResponse;
import com.ssafy.sdme.vendor.dto.VendorListResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping(ApiPath.PATH + "/vendors")
public class VendorController {

    private final VendorQueryService vendorQueryService;

    @GetMapping
    public ApiResponse<VendorListResponse> getVendors(
        @RequestParam(required = false) String category,
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) Long minPrice,
        @RequestParam(required = false) Long maxPrice,
        @RequestParam(required = false) Double rating,
        @RequestParam(required = false) String sort,
        @RequestParam(required = false) String cursor,
        @RequestParam(defaultValue = "20") int size
    ) {
        VendorListResponse response = vendorQueryService.getVendors(
            category,
            keyword,
            minPrice,
            maxPrice,
            rating,
            sort,
            cursor,
            size
        );
        return ApiResponse.ok(response);
    }

    @GetMapping("/{vendorId}")
    public ApiResponse<VendorDetailResponse> getVendorDetail(@PathVariable("vendorId") Long id) {
        return ApiResponse.ok(vendorQueryService.getVendorDetail(id));
    }
}
