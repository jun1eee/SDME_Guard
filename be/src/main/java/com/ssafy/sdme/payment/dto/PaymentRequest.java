package com.ssafy.sdme.payment.dto;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PaymentRequest {
    private Long reservationId;
    private Long cardId;
    private String type; // DEPOSIT or BALANCE
    private Integer amount;
}
