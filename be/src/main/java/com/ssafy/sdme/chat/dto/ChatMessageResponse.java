package com.ssafy.sdme.chat.dto;

import com.ssafy.sdme.chat.domain.CoupleChatMessage;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class ChatMessageResponse {

    private final Long id;
    private final Long senderId;
    private final String senderName;
    private final String senderRole;
    private final String content;
    private final String messageType;
    private final Long vendorId;
    private final LocalDateTime createdAt;

    private ChatMessageResponse(CoupleChatMessage message, String senderName, String senderRole) {
        this.id = message.getId();
        this.senderId = message.getSenderUserId();
        this.senderName = senderName;
        this.senderRole = senderRole;
        this.content = message.getContent();
        this.messageType = message.getMessageType().name();
        this.vendorId = message.getVendorId();
        this.createdAt = message.getCreatedAt();
    }

    public static ChatMessageResponse of(CoupleChatMessage message, String senderName, String senderRole) {
        return new ChatMessageResponse(message, senderName, senderRole);
    }
}
