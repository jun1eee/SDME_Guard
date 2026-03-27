package com.ssafy.sdme.couple.service;

import com.ssafy.sdme._global.exception.BadRequestException;
import com.ssafy.sdme._global.exception.ConflictException;
import com.ssafy.sdme._global.exception.NotFoundException;
import com.ssafy.sdme.chat.domain.CoupleChatMessage;
import com.ssafy.sdme.chat.domain.CoupleChatRoom;
import com.ssafy.sdme.chat.domain.MessageType;
import com.ssafy.sdme.chat.repository.CoupleChatMessageRepository;
import com.ssafy.sdme.chat.repository.CoupleChatRoomRepository;
import com.ssafy.sdme.couple.domain.*;
import com.ssafy.sdme.couple.dto.response.CoupleConnectResponse;
import com.ssafy.sdme.couple.dto.response.CoupleInviteResponse;
import com.ssafy.sdme.couple.dto.response.CouplePreferencesResponse;
import com.ssafy.sdme.couple.dto.response.CoupleResponse;
import com.ssafy.sdme.couple.repository.CoupleInviteRepository;
import com.ssafy.sdme.couple.repository.CoupleRepository;
import com.ssafy.sdme.user.domain.Role;
import com.ssafy.sdme.user.domain.User;
import com.ssafy.sdme.user.domain.UserPreference;
import com.ssafy.sdme.user.dto.response.UserPreferenceResponse;
import com.ssafy.sdme.user.repository.UserPreferenceRepository;
import com.ssafy.sdme.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Random;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class CoupleServiceImpl implements CoupleService {

    private final CoupleInviteRepository coupleInviteRepository;
    private final CoupleRepository coupleRepository;
    private final UserRepository userRepository;
    private final UserPreferenceRepository userPreferenceRepository;
    private final CoupleChatRoomRepository chatRoomRepository;
    private final CoupleChatMessageRepository chatMessageRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final com.ssafy.sdme.budget.repository.BudgetRepository budgetRepository;

    @Override
    public CoupleInviteResponse createInviteCode(Long userId) {
        // 기존 PENDING 초대코드가 있으면 그대로 반환
        return coupleInviteRepository.findFirstByInviterIdAndStatusOrderByIdDesc(userId, CoupleInviteStatus.PENDING)
                .map(existing -> {
                    if (existing.isExpired()) {
                        existing.expire();
                    } else {
                        log.info("[Couple] 기존 초대코드 반환 - userId: {}, code: {}", userId, existing.getInviteCode());
                        return CoupleInviteResponse.of(existing.getInviteCode());
                    }
                    return createNewInvite(userId);
                })
                .orElseGet(() -> createNewInvite(userId));
    }

    private CoupleInviteResponse createNewInvite(Long userId) {
        String code = generateCode();

        CoupleInvite invite = CoupleInvite.builder()
                .inviterId(userId)
                .inviteCode(code)
                .build();
        coupleInviteRepository.save(invite);

        log.info("[Couple] 초대코드 생성 - userId: {}, code: {}", userId, code);
        return CoupleInviteResponse.of(code);
    }

    @Override
    public CoupleConnectResponse connect(Long userId, String inviteCode) {
        // 1. 초대코드 조회
        CoupleInvite invite = coupleInviteRepository.findByInviteCodeAndStatus(inviteCode, CoupleInviteStatus.PENDING)
                .orElseThrow(() -> new NotFoundException("유효하지 않은 초대코드입니다."));

        // 2. 만료 체크
        if (invite.isExpired()) {
            invite.expire();
            throw new BadRequestException("만료된 초대코드입니다.");
        }

        // 3. 자기 자신 초대 방지
        if (invite.getInviterId().equals(userId)) {
            throw new BadRequestException("본인의 초대코드는 입력할 수 없습니다.");
        }

        // 4. 초대한 사람, 수락한 사람 조회
        User inviter = userRepository.findById(invite.getInviterId())
                .orElseThrow(() -> new NotFoundException("초대한 사용자를 찾을 수 없습니다."));
        User acceptor = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        // 5. 같은 역할이면 매칭 불가
        if (inviter.getRole() == acceptor.getRole()) {
            throw new BadRequestException("같은 역할끼리는 매칭할 수 없습니다.");
        }

        // 6. 초대한 사람의 커플에 수락한 사람 매칭
        Couple couple = coupleRepository.findById(inviter.getCoupleId())
                .orElseThrow(() -> new NotFoundException("커플 정보를 찾을 수 없습니다."));

        if (couple.getStatus() == CoupleStatus.MATCHED) {
            throw new ConflictException("이미 매칭된 커플입니다.");
        }

        // 신랑이 초대 → 신부가 수락 / 신부가 초대 → 신랑이 수락
        if (inviter.getRole() == Role.g) {
            couple.matchBride(userId);
        } else {
            couple.matchGroom(userId);
        }

        // 7. 수락한 사람의 coupleId 업데이트 (기존 혼자 커플 삭제)
        if (acceptor.getCoupleId() != null) {
            coupleRepository.deleteById(acceptor.getCoupleId());
        }
        acceptor.updateCoupleId(couple.getId());

        // 8. 초대 수락 처리
        invite.accept(userId);

        log.info("[Couple] 커플 매칭 완료 - coupleId: {}, inviter: {}, acceptor: {}", couple.getId(), inviter.getNickname(), acceptor.getNickname());

        // 선호도 비교 → 차이 있으면 시스템 메시지 전송
        try {
            sendPreferenceDiffMessage(couple, inviter, acceptor);
        } catch (Exception e) {
            log.warn("[Couple] 선호도 비교 메시지 전송 실패 - {}", e.getMessage());
        }

        // Budget 동기화: 양쪽 UserPreference에서 totalBudget 중 큰 값으로 설정
        try {
            Integer inviterBudget = userPreferenceRepository.findByUserId(inviter.getId())
                    .map(p -> p.getTotalBudget() != null ? p.getTotalBudget() : 0).orElse(0);
            Integer acceptorBudget = userPreferenceRepository.findByUserId(acceptor.getId())
                    .map(p -> p.getTotalBudget() != null ? p.getTotalBudget() : 0).orElse(0);
            int totalBudgetWon = Math.max(inviterBudget, acceptorBudget) * 10000;

            com.ssafy.sdme.budget.domain.Budget budget = budgetRepository.findByCoupleId(couple.getId())
                    .orElseGet(() -> budgetRepository.save(
                            com.ssafy.sdme.budget.domain.Budget.builder()
                                    .coupleId(couple.getId())
                                    .totalBudget(0)
                                    .build()
                    ));
            if (totalBudgetWon > 0) {
                budget.updateTotal(totalBudgetWon);
            }
            log.info("[Couple] Budget 동기화 - coupleId: {}, totalBudget: {}", couple.getId(), totalBudgetWon);
        } catch (Exception e) {
            log.warn("[Couple] Budget 동기화 실패 - {}", e.getMessage());
        }

        // 양쪽에 커플 매칭 완료 WebSocket push
        java.util.Map<String, Object> matchPayload = new java.util.HashMap<>();
        matchPayload.put("type", "MATCHED");
        matchPayload.put("coupleId", couple.getId());
        messagingTemplate.convertAndSend("/topic/couple/" + inviter.getId(), (Object) matchPayload);
        messagingTemplate.convertAndSend("/topic/couple/" + acceptor.getId(), (Object) matchPayload);

        return CoupleConnectResponse.of(couple.getId(), inviter.getNickname());
    }

    @Override
    @Transactional(readOnly = true)
    public CoupleResponse getMyCouple(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        if (user.getCoupleId() == null) {
            throw new NotFoundException("커플 정보가 없습니다.");
        }

        Couple couple = coupleRepository.findById(user.getCoupleId())
                .orElseThrow(() -> new NotFoundException("커플 정보를 찾을 수 없습니다."));

        User groom = couple.getGroomId() != null ? userRepository.findById(couple.getGroomId()).orElse(null) : null;
        User bride = couple.getBrideId() != null ? userRepository.findById(couple.getBrideId()).orElse(null) : null;

        log.info("[Couple] 커플 정보 조회 - userId: {}, coupleId: {}", userId, couple.getId());
        return CoupleResponse.of(couple, groom, bride);
    }

    @Override
    @Transactional(readOnly = true)
    public CouplePreferencesResponse getCouplePreferences(Long userId) {
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

        UserPreferenceResponse groomPref = userPreferenceRepository.findByUserId(couple.getGroomId())
                .map(UserPreferenceResponse::from)
                .orElse(UserPreferenceResponse.empty());

        UserPreferenceResponse bridePref = userPreferenceRepository.findByUserId(couple.getBrideId())
                .map(UserPreferenceResponse::from)
                .orElse(UserPreferenceResponse.empty());

        log.info("[Couple] 커플 선호도 조회 - userId: {}, coupleId: {}", userId, couple.getId());
        return CouplePreferencesResponse.of(groomPref, bridePref);
    }

    @Override
    public void disconnect(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        if (user.getCoupleId() == null) {
            throw new NotFoundException("커플 매칭 정보가 없습니다.");
        }

        Couple couple = coupleRepository.findById(user.getCoupleId())
                .orElseThrow(() -> new NotFoundException("커플 정보를 찾을 수 없습니다."));

        if (couple.getStatus() != CoupleStatus.MATCHED) {
            throw new BadRequestException("매칭된 커플이 아닙니다.");
        }

        // 커플 상태 변경
        couple.disconnect();

        // 양쪽 유저에게 새 PENDING 커플 생성
        Long partnerId = user.getRole() == Role.g ? couple.getBrideId() : couple.getGroomId();
        User partner = userRepository.findById(partnerId).orElse(null);

        // 본인 새 커플
        Couple myNewCouple = Couple.builder()
                .groomId(user.getRole() == Role.g ? user.getId() : null)
                .brideId(user.getRole() == Role.b ? user.getId() : null)
                .build();
        coupleRepository.save(myNewCouple);
        user.updateCoupleId(myNewCouple.getId());

        // 파트너 새 커플
        if (partner != null) {
            Couple partnerNewCouple = Couple.builder()
                    .groomId(partner.getRole() == Role.g ? partner.getId() : null)
                    .brideId(partner.getRole() == Role.b ? partner.getId() : null)
                    .build();
            coupleRepository.save(partnerNewCouple);
            partner.updateCoupleId(partnerNewCouple.getId());
        }

        log.info("[Couple] 커플 매칭 해제 - userId: {}, coupleId: {}", userId, couple.getId());

        // 양쪽에 커플 해제 WebSocket push
        java.util.Map<String, Object> disconnectPayload = new java.util.HashMap<>();
        disconnectPayload.put("type", "DISCONNECTED");
        messagingTemplate.convertAndSend("/topic/couple/" + userId, (Object) disconnectPayload);
        if (partner != null) {
            messagingTemplate.convertAndSend("/topic/couple/" + partner.getId(), (Object) disconnectPayload);
        }
    }

    private void sendPreferenceDiffMessage(Couple couple, User inviter, User acceptor) {
        UserPreference pref1 = userPreferenceRepository.findByUserId(inviter.getId()).orElse(null);
        UserPreference pref2 = userPreferenceRepository.findByUserId(acceptor.getId()).orElse(null);

        if (pref1 == null || pref2 == null) return;

        StringBuilder diff = new StringBuilder();

        // 결혼 예정일 비교
        if (pref1.getWeddingDate() != null && pref2.getWeddingDate() != null
                && !pref1.getWeddingDate().equals(pref2.getWeddingDate())) {
            diff.append("💍 결혼 예정일이 달라요! ")
                .append(inviter.getName()).append(": ").append(pref1.getWeddingDate())
                .append(" / ").append(acceptor.getName()).append(": ").append(pref2.getWeddingDate())
                .append("\n");
        }

        // 예산 비교
        if (pref1.getTotalBudget() != null && pref2.getTotalBudget() != null
                && !pref1.getTotalBudget().equals(pref2.getTotalBudget())) {
            diff.append("💰 예산이 달라요! ")
                .append(inviter.getName()).append(": ").append(pref1.getTotalBudget()).append("만원")
                .append(" / ").append(acceptor.getName()).append(": ").append(pref2.getTotalBudget()).append("만원")
                .append("\n");
        }

        // 하객 수 비교
        if (pref1.getGuestCount() != null && pref2.getGuestCount() != null
                && !pref1.getGuestCount().equals(pref2.getGuestCount())) {
            diff.append("👥 예상 하객 수가 달라요! ")
                .append(inviter.getName()).append(": ").append(pref1.getGuestCount()).append("명")
                .append(" / ").append(acceptor.getName()).append(": ").append(pref2.getGuestCount()).append("명")
                .append("\n");
        }

        if (diff.isEmpty()) return;

        String message = "🔔 커플 매칭이 완료되었어요!\n\n서로 입력한 정보가 조금 달라요. 한번 이야기해보세요!\n\n" + diff.toString().trim();

        // 채팅방 생성 또는 조회
        CoupleChatRoom room = chatRoomRepository.findByCoupleId(couple.getId())
                .orElseGet(() -> chatRoomRepository.save(
                        CoupleChatRoom.builder().coupleId(couple.getId()).build()
                ));

        // 시스템 메시지 저장 (senderId = 0으로 시스템 표시)
        CoupleChatMessage systemMsg = CoupleChatMessage.builder()
                .coupleChatRoomId(room.getId())
                .senderUserId(0L)
                .content(message)
                .messageType(MessageType.system)
                .build();
        chatMessageRepository.save(systemMsg);

        log.info("[Couple] 선호도 차이 시스템 메시지 전송 - coupleId: {}", couple.getId());
    }

    private String generateCode() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        Random random = new Random();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 6; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }
}
