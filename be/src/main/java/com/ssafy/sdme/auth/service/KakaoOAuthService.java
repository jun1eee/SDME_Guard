package com.ssafy.sdme.auth.service;

import com.ssafy.sdme.auth.dto.response.KakaoTokenResponse;
import com.ssafy.sdme.auth.dto.response.KakaoUserInfoResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

@Slf4j
@Service
@RequiredArgsConstructor
public class KakaoOAuthService {

    private final RestTemplate restTemplate;

    @Value("${kakao.client-id}")
    private String clientId;

    @Value("${kakao.client-secret}")
    private String clientSecret;

    @Value("${kakao.redirect-uri}")
    private String redirectUri;

    private static final String TOKEN_URL = "https://kauth.kakao.com/oauth/token";
    private static final String USER_INFO_URL = "https://kapi.kakao.com/v2/user/me";

    /**
     * 카카오 인가 코드로 액세스 토큰 발급
     */
    public KakaoTokenResponse getAccessToken(String code) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("grant_type", "authorization_code");
        params.add("client_id", clientId);
        params.add("client_secret", clientSecret);
        params.add("redirect_uri", redirectUri);
        params.add("code", code);

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(params, headers);

        log.info("[Kakao] 토큰 요청 - clientId: {}, redirectUri: {}, code: {}...", clientId, redirectUri, code.substring(0, Math.min(10, code.length())));

        try {
            ResponseEntity<KakaoTokenResponse> response = restTemplate.exchange(
                    TOKEN_URL, HttpMethod.POST, request, KakaoTokenResponse.class
            );

            log.info("[Kakao] 토큰 발급 완료");
            return response.getBody();
        } catch (HttpClientErrorException e) {
            log.error("[Kakao] 토큰 요청 실패 - status: {}, body: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw e;
        }
    }

    /**
     * 카카오 액세스 토큰으로 사용자 정보 조회
     */
    public KakaoUserInfoResponse getUserInfo(String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        HttpEntity<Void> request = new HttpEntity<>(headers);

        log.info("[Kakao] 사용자 정보 요청");

        ResponseEntity<KakaoUserInfoResponse> response = restTemplate.exchange(
                USER_INFO_URL, HttpMethod.GET, request, KakaoUserInfoResponse.class
        );

        KakaoUserInfoResponse userInfo = response.getBody();
        log.info("[Kakao] 사용자 정보 조회 완료 - kakaoId: {}", userInfo != null ? userInfo.getKakaoId() : "null");

        return userInfo;
    }
}
