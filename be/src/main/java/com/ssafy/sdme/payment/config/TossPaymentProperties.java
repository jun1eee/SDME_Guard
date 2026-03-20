package com.ssafy.sdme.payment.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "toss.payments")
public class TossPaymentProperties {
    private String secretKey;
    private String clientKey;
    private String baseUrl = "https://api.tosspayments.com/v1";
}
