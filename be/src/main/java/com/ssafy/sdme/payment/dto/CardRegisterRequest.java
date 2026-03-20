package com.ssafy.sdme.payment.dto;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CardRegisterRequest {
    private String authKey;
    private String customerKey;
}
