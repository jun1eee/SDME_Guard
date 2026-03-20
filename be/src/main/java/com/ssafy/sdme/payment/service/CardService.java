package com.ssafy.sdme.payment.service;

import com.ssafy.sdme._global.exception.BadRequestException;
import com.ssafy.sdme._global.exception.NotFoundException;
import com.ssafy.sdme.payment.domain.CardInformation;
import com.ssafy.sdme.payment.dto.CardRegisterRequest;
import com.ssafy.sdme.payment.dto.CardResponse;
import com.ssafy.sdme.payment.repository.CardInformationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CardService {

    private final CardInformationRepository cardRepository;
    private final TossPaymentService tossPaymentService;

    @Transactional
    public CardResponse registerCard(Long userId, CardRegisterRequest request) {
        String customerKey = request.getCustomerKey();
        if (customerKey == null || customerKey.isBlank()) {
            customerKey = "user_" + userId + "_" + UUID.randomUUID().toString().substring(0, 8);
        }

        Map<String, Object> result = tossPaymentService.issueBillingKey(request.getAuthKey(), customerKey);

        String billingKey = (String) result.get("billingKey");
        Map<String, Object> card = (Map<String, Object>) result.get("card");

        String cardBrand = card != null ? (String) card.get("issuerCode") : null;
        String cardLast4 = card != null ? (String) card.get("number") : null;
        if (cardLast4 != null && cardLast4.length() > 4) {
            cardLast4 = cardLast4.substring(cardLast4.length() - 4);
        }

        CardInformation cardInfo = CardInformation.builder()
                .userId(userId)
                .pgProvider("toss_payments")
                .customerKey(customerKey)
                .billingKey(billingKey)
                .methodProvider("CARD")
                .cardBrand(cardBrand)
                .cardLast4(cardLast4)
                .build();

        cardRepository.save(cardInfo);
        log.info("[Card] 카드 등록 - userId: {}, cardLast4: {}", userId, cardLast4);
        return CardResponse.from(cardInfo);
    }

    @Transactional(readOnly = true)
    public List<CardResponse> getCards(Long userId) {
        return cardRepository.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)
                .stream()
                .map(CardResponse::from)
                .toList();
    }

    @Transactional
    public void deleteCard(Long userId, Long cardId) {
        CardInformation card = cardRepository.findByIdAndUserIdAndDeletedAtIsNull(cardId, userId)
                .orElseThrow(() -> new NotFoundException("카드를 찾을 수 없습니다."));
        card.softDelete();
        log.info("[Card] 카드 삭제 - userId: {}, cardId: {}", userId, cardId);
    }
}
