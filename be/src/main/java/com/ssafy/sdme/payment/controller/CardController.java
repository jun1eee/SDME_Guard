package com.ssafy.sdme.payment.controller;

import com.ssafy.sdme._global.ApiResponse;
import com.ssafy.sdme._global.common.constant.ApiPath;
import com.ssafy.sdme.payment.dto.CardRegisterRequest;
import com.ssafy.sdme.payment.dto.CardResponse;
import com.ssafy.sdme.payment.service.CardService;
import com.ssafy.sdme.payment.service.TossPaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "Card", description = "카드 관리 API")
@RestController
@RequestMapping(ApiPath.PATH + "/cards")
@RequiredArgsConstructor
public class CardController {

    private final CardService cardService;
    private final TossPaymentService tossPaymentService;

    @Operation(summary = "카드 등록", description = "토스 빌링키를 발급하여 카드를 등록합니다.")
    @PostMapping
    public ApiResponse<CardResponse> registerCard(@RequestBody CardRegisterRequest request,
                                                   HttpServletRequest httpRequest) {
        Long userId = (Long) httpRequest.getAttribute("userId");
        return ApiResponse.created(cardService.registerCard(userId, request));
    }

    @Operation(summary = "등록된 카드 목록 조회", description = "등록된 카드 목록을 조회합니다.")
    @GetMapping
    public ApiResponse<List<CardResponse>> getCards(HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        return ApiResponse.ok(cardService.getCards(userId));
    }

    @Operation(summary = "카드 삭제", description = "등록된 카드를 삭제합니다.")
    @DeleteMapping("/{cardId}")
    public ApiResponse<Void> deleteCard(@PathVariable Long cardId, HttpServletRequest request) {
        Long userId = (Long) request.getAttribute("userId");
        cardService.deleteCard(userId, cardId);
        return ApiResponse.ok(null);
    }

    @Operation(summary = "토스 클라이언트 키 조회", description = "프론트에서 사용할 토스 클라이언트 키를 조회합니다.")
    @GetMapping("/toss-client-key")
    public ApiResponse<Map<String, String>> getTossClientKey() {
        return ApiResponse.ok(Map.of("clientKey", tossPaymentService.getClientKey()));
    }
}
