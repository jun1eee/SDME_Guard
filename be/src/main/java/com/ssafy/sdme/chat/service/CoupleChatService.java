package com.ssafy.sdme.chat.service;

import com.ssafy.sdme._global.exception.NotFoundException;
import com.ssafy.sdme.chat.domain.CoupleChatMessage;
import com.ssafy.sdme.chat.domain.CoupleChatRoom;
import com.ssafy.sdme.chat.domain.MessageType;
import com.ssafy.sdme.chat.dto.ChatMessageRequest;
import com.ssafy.sdme.chat.dto.ChatMessageResponse;
import com.ssafy.sdme.chat.dto.CoupleAiSessionResponse;
import com.ssafy.sdme.chat.repository.CoupleChatMessageRepository;
import com.ssafy.sdme.chat.repository.CoupleChatRoomRepository;
import com.ssafy.sdme.couple.domain.Couple;
import com.ssafy.sdme.couple.domain.CoupleStatus;
import com.ssafy.sdme.couple.repository.CoupleRepository;
import com.ssafy.sdme.user.domain.Role;
import com.ssafy.sdme.user.domain.User;
import com.ssafy.sdme.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CoupleChatService {

    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
            "image/jpeg", "image/png", "image/gif", "image/webp"
    );
    private static final long MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

    private final CoupleChatRoomRepository chatRoomRepository;
    private final CoupleChatMessageRepository chatMessageRepository;
    private final CoupleRepository coupleRepository;
    private final UserRepository userRepository;

    @Transactional
    public ChatMessageResponse saveAndCreateResponse(ChatMessageRequest request) {
        // 채팅방 조회 또는 생성
        CoupleChatRoom room = chatRoomRepository.findByCoupleId(request.getCoupleId())
                .orElseGet(() -> chatRoomRepository.save(
                        CoupleChatRoom.builder().coupleId(request.getCoupleId()).build()
                ));

        // 메시지 저장
        MessageType type;
        try {
            type = MessageType.valueOf(request.getMessageType());
        } catch (Exception e) {
            type = MessageType.text;
        }

        CoupleChatMessage message = CoupleChatMessage.builder()
                .coupleChatRoomId(room.getId())
                .senderUserId(request.getSenderId())
                .content(request.getContent())
                .messageType(type)
                .vendorId(request.getVendorId())
                .build();
        chatMessageRepository.save(message);

        // 발신자 정보
        User sender = userRepository.findById(request.getSenderId()).orElse(null);
        String senderName = sender != null ? sender.getName() : "알 수 없음";
        String senderRole = sender != null && sender.getRole() != null ? (sender.getRole() == Role.g ? "groom" : "bride") : "unknown";

        log.info("[Chat] 메시지 저장 - coupleId: {}, sender: {}", request.getCoupleId(), senderName);
        return ChatMessageResponse.of(message, senderName, senderRole);
    }

    @Transactional
    public ChatMessageResponse saveImageMessage(Long userId, Long coupleId, MultipartFile file) {
        // 파일 검증
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_IMAGE_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("허용되지 않는 이미지 형식입니다. (jpeg, png, gif, webp)");
        }
        if (file.getSize() > MAX_IMAGE_SIZE) {
            throw new IllegalArgumentException("이미지 크기는 10MB 이하여야 합니다.");
        }

        // 파일 저장
        String ext = "";
        String originalFilename = file.getOriginalFilename();
        if (originalFilename != null && originalFilename.contains(".")) {
            ext = originalFilename.substring(originalFilename.lastIndexOf("."));
        } else {
            ext = "." + contentType.split("/")[1];
        }
        String filename = coupleId + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8) + ext;

        Path uploadDir;
        if (System.getProperty("os.name").toLowerCase().contains("win")) {
            uploadDir = Paths.get(System.getProperty("user.home"), "uploads", "chat");
        } else {
            uploadDir = Paths.get("/uploads/chat");
        }

        try {
            Files.createDirectories(uploadDir);
            Files.copy(file.getInputStream(), uploadDir.resolve(filename), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            log.error("[Chat] 이미지 저장 실패 - coupleId: {}, userId: {}", coupleId, userId, e);
            throw new RuntimeException("이미지 저장에 실패했습니다.", e);
        }

        String imageUrl = "/uploads/chat/" + filename;

        // 채팅방 조회/생성 + 메시지 저장
        CoupleChatRoom room = chatRoomRepository.findByCoupleId(coupleId)
                .orElseGet(() -> chatRoomRepository.save(
                        CoupleChatRoom.builder().coupleId(coupleId).build()
                ));

        CoupleChatMessage message = CoupleChatMessage.builder()
                .coupleChatRoomId(room.getId())
                .senderUserId(userId)
                .content(imageUrl)
                .messageType(MessageType.image)
                .build();
        chatMessageRepository.save(message);

        User sender = userRepository.findById(userId).orElse(null);
        String senderName = sender != null ? sender.getName() : "알 수 없음";
        String senderRole = sender != null && sender.getRole() != null
                ? (sender.getRole() == Role.g ? "groom" : "bride") : "unknown";

        log.info("[Chat] 이미지 메시지 저장 - coupleId: {}, sender: {}, url: {}", coupleId, senderName, imageUrl);
        return ChatMessageResponse.of(message, senderName, senderRole);
    }

    @Transactional(readOnly = true)
    public List<ChatMessageResponse> getMessages(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        if (user.getCoupleId() == null) {
            throw new NotFoundException("커플 매칭이 되어있지 않습니다.");
        }

        Couple couple = coupleRepository.findById(user.getCoupleId())
                .orElseThrow(() -> new NotFoundException("커플 정보를 찾을 수 없습니다."));

        if (couple.getStatus() != CoupleStatus.MATCHED) {
            throw new NotFoundException("커플 매칭이 완료되지 않았습니다.");
        }

        CoupleChatRoom room = chatRoomRepository.findByCoupleId(couple.getId())
                .orElse(null);

        if (room == null) {
            return List.of();
        }

        // 신랑/신부 정보 조회
        User groom = couple.getGroomId() != null ? userRepository.findById(couple.getGroomId()).orElse(null) : null;
        User bride = couple.getBrideId() != null ? userRepository.findById(couple.getBrideId()).orElse(null) : null;

        return chatMessageRepository.findByCoupleChatRoomIdOrderByCreatedAtAsc(room.getId())
                .stream()
                .map(msg -> {
                    String name;
                    String role;
                    if (groom != null && msg.getSenderUserId().equals(groom.getId())) {
                        name = groom.getName();
                        role = "groom";
                    } else if (bride != null && msg.getSenderUserId().equals(bride.getId())) {
                        name = bride.getName();
                        role = "bride";
                    } else {
                        name = "알 수 없음";
                        role = "unknown";
                    }
                    return ChatMessageResponse.of(msg, name, role);
                })
                .toList();
    }

    @Transactional
    public void selectAiSession(Long userId, String sessionId) {
        Couple couple = coupleRepository.findByGroomIdOrBrideId(userId, userId)
                .orElseThrow(() -> new NotFoundException("커플 정보를 찾을 수 없습니다."));

        CoupleChatRoom room = chatRoomRepository.findByCoupleId(couple.getId())
                .orElseGet(() -> chatRoomRepository.save(
                        CoupleChatRoom.builder().coupleId(couple.getId()).build()
                ));

        if (userId.equals(couple.getGroomId())) {
            room.setGroomAiSessionId(sessionId);
        } else {
            room.setBrideAiSessionId(sessionId);
        }
        chatRoomRepository.save(room);
        log.info("[CoupleChat] AI 세션 선택 - userId: {}, sessionId: {}", userId, sessionId);
    }

    @Transactional
    public void clearAiSession(Long userId) {
        Couple couple = coupleRepository.findByGroomIdOrBrideId(userId, userId)
                .orElseThrow(() -> new NotFoundException("커플 정보를 찾을 수 없습니다."));

        CoupleChatRoom room = chatRoomRepository.findByCoupleId(couple.getId())
                .orElse(null);
        if (room == null) return;

        if (userId.equals(couple.getGroomId())) {
            room.setGroomAiSessionId(null);
        } else {
            room.setBrideAiSessionId(null);
        }
        chatRoomRepository.save(room);
        log.info("[CoupleChat] AI 세션 해제 - userId: {}", userId);
    }

    @Transactional(readOnly = true)
    public CoupleAiSessionResponse getSelectedSessions(Long userId) {
        Couple couple = coupleRepository.findByGroomIdOrBrideId(userId, userId)
                .orElseThrow(() -> new NotFoundException("커플 정보를 찾을 수 없습니다."));

        CoupleChatRoom room = chatRoomRepository.findByCoupleId(couple.getId())
                .orElse(null);

        if (room == null) {
            return CoupleAiSessionResponse.builder().build();
        }

        return CoupleAiSessionResponse.builder()
                .groomAiSessionId(room.getGroomAiSessionId())
                .brideAiSessionId(room.getBrideAiSessionId())
                .build();
    }
}
