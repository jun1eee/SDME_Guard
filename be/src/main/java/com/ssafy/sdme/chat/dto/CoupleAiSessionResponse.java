package com.ssafy.sdme.chat.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CoupleAiSessionResponse {
    private String groomAiSessionId;
    private String brideAiSessionId;
}
