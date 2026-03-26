package com.ssafy.sdme.chat.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CoupleAiChatRequest {
    @NotBlank(message = "메시지를 입력해주세요")
    private String message;
    private String sessionId;
}
