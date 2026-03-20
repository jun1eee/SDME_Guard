package com.ssafy.sdme.chat.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "COUPLE_CHAT_MESSAGES")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CoupleChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "couple_chat_room_id", nullable = false)
    private Long coupleChatRoomId;

    @Column(name = "sender_user_id", nullable = false)
    private Long senderUserId;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(name = "message_type")
    private MessageType messageType;

    @Column(name = "vendor_id")
    private Long vendorId;

    @Column(name = "vendor_share_id")
    private Long vendorShareId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Builder
    public CoupleChatMessage(Long coupleChatRoomId, Long senderUserId, String content,
                              MessageType messageType, Long vendorId, Long vendorShareId) {
        this.coupleChatRoomId = coupleChatRoomId;
        this.senderUserId = senderUserId;
        this.content = content;
        this.messageType = messageType != null ? messageType : MessageType.text;
        this.vendorId = vendorId;
        this.vendorShareId = vendorShareId;
        this.createdAt = LocalDateTime.now();
    }
}
