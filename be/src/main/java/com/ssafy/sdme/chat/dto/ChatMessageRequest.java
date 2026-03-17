package com.ssafy.sdme.chat.dto;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatMessageRequest {

    private Long senderId;
    private Long coupleId;
    private String content;
    private String messageType; // text, vendor_share
    private Long vendorId;
}
