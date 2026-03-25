package com.ssafy.sdme.vendor.controller;

import com.ssafy.sdme._global.ApiResponse;
import com.ssafy.sdme._global.common.constant.ApiPath;
import com.ssafy.sdme.vendor.application.FittingService;
import com.ssafy.sdme.vendor.dto.FittingResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Base64;
import java.util.Map;

@Tag(name = "Fitting", description = "드레스 가상 피팅 API")
@RestController
@RequestMapping(ApiPath.PATH + "/vendors")
@RequiredArgsConstructor
public class FittingController {

    private final FittingService fittingService;

    @Operation(summary = "드레스 가상 피팅", description = "전신 사진을 업로드하면 해당 드레스 업체의 드레스를 AI로 입혀 반환합니다.")
    @PostMapping(value = "/{vendorId}/fitting", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<FittingResponse> dressFitting(
            @PathVariable Long vendorId,
            @RequestParam("personImage") MultipartFile personImage,
            @RequestParam("dressImageUrl") String dressImageUrl,
            HttpServletRequest request
    ) throws IOException {
        return ApiResponse.ok(fittingService.fit(vendorId, personImage, dressImageUrl));
    }

    @Operation(summary = "AI 피팅 결과 수신", description = "AI 서버에서 생성된 피팅 결과 이미지를 수신합니다.")
    @PostMapping(value = "/fitting/result", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> receiveFittingResult(
            @RequestParam("file") MultipartFile file
    ) throws IOException {
        String resultB64 = Base64.getEncoder().encodeToString(file.getBytes());
        return ResponseEntity.ok(Map.of("result_b64", resultB64));
    }
}
