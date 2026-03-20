package com.ssafy.sdme.payment.dto;

import com.ssafy.sdme.payment.domain.CardInformation;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class CardResponse {
    private Long id;
    private String cardBrand;
    private String cardLast4;
    private String ownerName;
    private LocalDateTime createdAt;

    public static CardResponse from(CardInformation card) {
        return CardResponse.builder()
                .id(card.getId())
                .cardBrand(card.getCardBrand())
                .cardLast4(card.getCardLast4())
                .ownerName(card.getOwnerName())
                .createdAt(card.getCreatedAt())
                .build();
    }
}
