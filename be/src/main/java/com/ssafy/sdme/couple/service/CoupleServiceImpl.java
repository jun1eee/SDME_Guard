package com.ssafy.sdme.couple.service;

import com.ssafy.sdme._global.exception.BadRequestException;
import com.ssafy.sdme._global.exception.ConflictException;
import com.ssafy.sdme._global.exception.NotFoundException;
import com.ssafy.sdme.couple.domain.*;
import com.ssafy.sdme.couple.dto.response.CoupleConnectResponse;
import com.ssafy.sdme.couple.dto.response.CoupleInviteResponse;
import com.ssafy.sdme.couple.dto.response.CoupleResponse;
import com.ssafy.sdme.couple.repository.CoupleInviteRepository;
import com.ssafy.sdme.couple.repository.CoupleRepository;
import com.ssafy.sdme.user.domain.Role;
import com.ssafy.sdme.user.domain.User;
import com.ssafy.sdme.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

    @Override
    public CoupleInviteResponse createInviteCode(Long userId) {
        // 기존 PENDING 초대코드가 있으면 그대로 반환
        return coupleInviteRepository.findByInviterIdAndStatus(userId, CoupleInviteStatus.PENDING)
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

        // 상대방 닉네임 조회
        String partnerNickname = null;
        if (couple.getStatus() == CoupleStatus.MATCHED) {
            Long partnerId = user.getRole() == Role.g ? couple.getBrideId() : couple.getGroomId();
            partnerNickname = userRepository.findById(partnerId)
                    .map(User::getNickname)
                    .orElse(null);
        }

        log.info("[Couple] 커플 정보 조회 - userId: {}, coupleId: {}", userId, couple.getId());
        return CoupleResponse.of(couple, partnerNickname);
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
