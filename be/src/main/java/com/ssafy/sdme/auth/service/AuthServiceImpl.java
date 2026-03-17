package com.ssafy.sdme.auth.service;

import com.ssafy.sdme._global.common.constant.ErrorMessage;
import com.ssafy.sdme._global.exception.BadRequestException;
import com.ssafy.sdme._global.exception.NotFoundException;
import io.jsonwebtoken.Claims;
import com.ssafy.sdme.auth.dto.request.SignupRequest;
import com.ssafy.sdme.auth.dto.response.*;
import com.ssafy.sdme.auth.jwt.JwtUtil;
import com.ssafy.sdme.couple.domain.Couple;
import com.ssafy.sdme.couple.repository.CoupleRepository;
import com.ssafy.sdme.user.domain.Role;
import com.ssafy.sdme.user.domain.User;
import com.ssafy.sdme.user.repository.UserPreferenceRepository;
import com.ssafy.sdme.user.repository.UserRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class AuthServiceImpl implements AuthService {

    private final KakaoOAuthService kakaoOAuthService;
    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final CoupleRepository coupleRepository;
    private final UserPreferenceRepository userPreferenceRepository;

    @Override
    public LoginResponse kakaoLogin(String code) {
        // 1. 카카오 인가 코드로 액세스 토큰 발급
        KakaoTokenResponse tokenResponse = kakaoOAuthService.getAccessToken(code);

        // 2. 카카오 액세스 토큰으로 사용자 정보 조회
        KakaoUserInfoResponse userInfo = kakaoOAuthService.getUserInfo(tokenResponse.getAccessToken());

        String kakaoId = userInfo.getKakaoId();

        // 3. 기존 사용자 확인
        Optional<User> existingUser = userRepository.findByKakaoId(kakaoId);

        if (existingUser.isPresent()) {
            User user = existingUser.get();

            // 탈퇴한 사용자 → 재가입 처리 (신규 유저처럼)
            if (user.getDeletedAt() != null) {
                user.rejoin(userInfo.getNickname(), userInfo.getProfileImageUrl());
                String accessToken = jwtUtil.createAccessToken(user.getId(), user.getKakaoId(), "");
                String refreshToken = jwtUtil.createRefreshToken(user.getId(), user.getKakaoId(), "");
                log.info("[Auth] 탈퇴 유저 재가입 - userId: {}", user.getId());
                return LoginResponse.of(true, accessToken, refreshToken,
                        userInfo.getNickname(), userInfo.getProfileImageUrl());
            }

            // 기존 사용자 → JWT 발급
            String role = user.getRole() != null ? user.getRole().name() : "";
            String accessToken = jwtUtil.createAccessToken(user.getId(), user.getKakaoId(), role);
            String refreshToken = jwtUtil.createRefreshToken(user.getId(), user.getKakaoId(), role);

            log.info("[Auth] 기존 사용자 로그인 - userId: {}, nickname: {}", user.getId(), user.getNickname());

            return LoginResponse.of(false, accessToken, refreshToken,
                    user.getNickname(), user.getProfileImage());
        }

        // 4. 신규 사용자 → 유저 생성 + JWT 발급
        User newUser = User.builder()
                .kakaoId(kakaoId)
                .nickname(userInfo.getNickname())
                .profileImage(userInfo.getProfileImageUrl())
                .build();
        userRepository.save(newUser);

        String accessToken = jwtUtil.createAccessToken(newUser.getId(), newUser.getKakaoId(), "");
        String refreshToken = jwtUtil.createRefreshToken(newUser.getId(), newUser.getKakaoId(), "");

        log.info("[Auth] 신규 사용자 생성 - userId: {}, kakaoId: {}", newUser.getId(), kakaoId);

        return LoginResponse.of(true, accessToken, refreshToken,
                userInfo.getNickname(), userInfo.getProfileImageUrl());
    }

    @Override
    public SignupResponse signup(Long userId, SignupRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        if (user.getRole() != null) {
            throw new BadRequestException("이미 가입이 완료된 사용자입니다.");
        }

        Role role;
        try {
            role = Role.valueOf(request.getRole());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("유효하지 않은 역할입니다. (g 또는 b)");
        }

        // 1. 사용자 프로필 업데이트
        user.updateProfile(request.getName(), role, request.getNickname());

        // 2. 커플 생성 (혼자짜리 PENDING 상태)
        Couple couple = Couple.builder()
                .groomId(role == Role.g ? user.getId() : null)
                .brideId(role == Role.b ? user.getId() : null)
                .build();
        coupleRepository.save(couple);

        // 3. 유저에 coupleId 세팅
        user.updateCoupleId(couple.getId());

        log.info("[Auth] 가입 완료 - userId: {}, nickname: {}, role: {}, coupleId: {}", user.getId(), user.getNickname(), role, couple.getId());

        return SignupResponse.from(user);
    }

    @Override
    public LoginResponse reissue(String refreshToken) {
        // 1. refreshToken 검증
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new BadRequestException(ErrorMessage.NOT_FOUND_REFRESH_TOKEN);
        }

        // 2. 만료 체크
        if (jwtUtil.isExpired(refreshToken)) {
            throw new BadRequestException(ErrorMessage.REFRESH_TOKEN_EXPIRED);
        }

        // 3. refresh 토큰인지 확인
        Claims claims = jwtUtil.extractAllClaims(refreshToken);
        String category = claims.get("category", String.class);
        if (!"refresh".equals(category)) {
            throw new BadRequestException(ErrorMessage.NOT_REFRESH_TOKEN);
        }

        // 4. 유저 확인
        Long userId = claims.get("id", Long.class);
        String kakaoId = claims.get("kakaoId", String.class);
        String role = claims.get("role", String.class);

        if (!userRepository.existsById(userId)) {
            throw new NotFoundException("사용자를 찾을 수 없습니다.");
        }

        // 5. 새 토큰 발급
        String newAccessToken = jwtUtil.createAccessToken(userId, kakaoId, role);
        String newRefreshToken = jwtUtil.createRefreshToken(userId, kakaoId, role);

        log.info("[Auth] 토큰 재발급 - userId: {}", userId);

        return LoginResponse.of(false, newAccessToken, newRefreshToken, null, null);
    }

    @Override
    public void logout(String accessToken) {
        // TODO: 토큰 블랙리스트 처리 (Redis 도입 시)
        log.info("[Auth] 로그아웃 처리");
    }

    @Override
    public void withdraw(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        // 커플 매칭 되어있으면 해제
        if (user.getCoupleId() != null) {
            Couple couple = coupleRepository.findById(user.getCoupleId()).orElse(null);
            if (couple != null && couple.getStatus() == com.ssafy.sdme.couple.domain.CoupleStatus.MATCHED) {
                couple.disconnect();
                Long partnerId = user.getRole() == Role.g ? couple.getBrideId() : couple.getGroomId();
                User partner = userRepository.findById(partnerId).orElse(null);
                if (partner != null) {
                    partner.updateCoupleId(null);
                }
            }
        }

        // 선호도 삭제
        userPreferenceRepository.findByUserId(userId)
                .ifPresent(userPreferenceRepository::delete);

        // soft delete
        user.withdraw();

        log.info("[Auth] 회원탈퇴 - userId: {}", userId);
    }
}
