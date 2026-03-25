package com.ssafy.sdme.vendor.application;

import com.ssafy.sdme._global.exception.BadRequestException;
import com.ssafy.sdme._global.exception.NotFoundException;
import com.ssafy.sdme.vendor.domain.Vendor;
import com.ssafy.sdme.vendor.dto.FittingResponse;
import com.ssafy.sdme.vendor.repository.VendorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;


@Slf4j
@Service
@RequiredArgsConstructor
public class FittingService {

    private final VendorRepository vendorRepository;
    private final RestTemplate restTemplate;

    @Value("${ai.server-url}")
    private String aiServerUrl;

    public FittingResponse fit(Long vendorId, MultipartFile personImage, String dressImageUrl) throws IOException {
        Vendor vendor = vendorRepository.findById(vendorId)
                .orElseThrow(() -> new NotFoundException("업체를 찾을 수 없습니다."));

        if (!"dress".equalsIgnoreCase(vendor.getCategory())) {
            throw new BadRequestException("드레스 업체에서만 가상 피팅을 이용할 수 있습니다.");
        }

        // AI 서버 호출 (person_image 파일 + dress_image_url 문자열)
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        ByteArrayResource personResource = new ByteArrayResource(personImage.getBytes()) {
            @Override public String getFilename() {
                return personImage.getOriginalFilename() != null ? personImage.getOriginalFilename() : "person.jpg";
            }
        };

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("person_image", personResource);
        body.add("dress_image_url", dressImageUrl);

        HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);

        String url = aiServerUrl + "/generate";
        log.info("[Fitting] AI 서버 호출 - vendorId: {}, url: {}", vendorId, url);

        @SuppressWarnings("unchecked")
        ResponseEntity<Map<String, Object>> response = restTemplate.postForEntity(
                url, request, (Class<Map<String, Object>>) (Class<?>) Map.class
        );

        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) response.getBody().get("data");
        String resultB64 = data != null ? (String) data.get("result_b64") : null;

        if (resultB64 == null) {
            throw new RuntimeException("AI 서버에서 결과 이미지를 받지 못했습니다.");
        }

        log.info("[Fitting] AI 피팅 완료 - vendorId: {}", vendorId);
        return new FittingResponse(vendor.getId(), vendor.getName(), resultB64);
    }
}
