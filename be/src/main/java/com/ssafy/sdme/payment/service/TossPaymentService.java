package com.ssafy.sdme.payment.service;

import com.ssafy.sdme.payment.config.TossPaymentProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class TossPaymentService {

    private final RestTemplate restTemplate;
    private final TossPaymentProperties properties;

    /**
     * 빌링키 발급 (카드 등록)
     * POST /v1/billing/authorizations/issue
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> issueBillingKey(String authKey, String customerKey) {
        String url = properties.getBaseUrl() + "/billing/authorizations/issue";

        Map<String, String> body = Map.of(
                "authKey", authKey,
                "customerKey", customerKey
        );

        HttpEntity<Map<String, String>> request = new HttpEntity<>(body, createHeaders());

        log.info("[TossPayment] 빌링키 발급 요청 - customerKey: {}", customerKey);
        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, request, Map.class);

        log.info("[TossPayment] 빌링키 발급 성공 - customerKey: {}", customerKey);
        return response.getBody();
    }

    /**
     * 빌링키로 결제 요청
     * POST /v1/billing/{billingKey}
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> requestPayment(String billingKey, String customerKey,
                                               String orderId, Integer amount, String orderName) {
        String url = properties.getBaseUrl() + "/billing/" + billingKey;

        Map<String, Object> body = Map.of(
                "customerKey", customerKey,
                "orderId", orderId,
                "amount", amount,
                "orderName", orderName
        );

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, createHeaders());

        log.info("[TossPayment] 결제 요청 - orderId: {}, amount: {}", orderId, amount);
        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, request, Map.class);

        log.info("[TossPayment] 결제 성공 - orderId: {}, paymentKey: {}", orderId, response.getBody().get("paymentKey"));
        return response.getBody();
    }

    private HttpHeaders createHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String encoded = Base64.getEncoder()
                .encodeToString((properties.getSecretKey() + ":").getBytes(StandardCharsets.UTF_8));
        headers.set("Authorization", "Basic " + encoded);
        return headers;
    }

    public String getClientKey() {
        return properties.getClientKey();
    }
}
