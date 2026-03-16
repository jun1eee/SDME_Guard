package com.ssafy.sdme.user.service;

import com.ssafy.sdme._global.exception.NotFoundException;
import com.ssafy.sdme.couple.domain.Couple;
import com.ssafy.sdme.couple.domain.CoupleStatus;
import com.ssafy.sdme.couple.repository.CoupleRepository;
import com.ssafy.sdme.user.domain.Role;
import com.ssafy.sdme.user.domain.User;
import com.ssafy.sdme.user.domain.UserPreference;
import com.ssafy.sdme.user.dto.request.UserEditRequest;
import com.ssafy.sdme.user.dto.request.UserPreferenceRequest;
import com.ssafy.sdme.user.dto.response.UserEditResponse;
import com.ssafy.sdme.user.dto.response.UserPreferenceResponse;
import com.ssafy.sdme.user.dto.response.UserResponse;
import com.ssafy.sdme.user.repository.UserPreferenceRepository;
import com.ssafy.sdme.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final CoupleRepository coupleRepository;
    private final UserPreferenceRepository userPreferenceRepository;

    @Override
    public UserResponse getMyInfo(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        String partnerNickname = null;
        if (user.getCoupleId() != null) {
            Couple couple = coupleRepository.findById(user.getCoupleId()).orElse(null);
            if (couple != null && couple.getStatus() == CoupleStatus.MATCHED) {
                Long partnerId = user.getRole() == Role.g ? couple.getBrideId() : couple.getGroomId();
                partnerNickname = userRepository.findById(partnerId)
                        .map(User::getNickname)
                        .orElse(null);
            }
        }

        log.info("[User] 내 정보 조회 - userId: {}", userId);
        return UserResponse.of(user, partnerNickname);
    }

    @Override
    @Transactional
    public UserEditResponse editUser(Long userId, UserEditRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        // 개인 정보 수정
        user.editInfo(request.getNickname());

        // 커플 매칭 되어있으면 groomName, brideName도 수정
        Couple couple = null;
        if (user.getCoupleId() != null) {
            couple = coupleRepository.findById(user.getCoupleId()).orElse(null);
            if (couple != null && couple.getStatus() == CoupleStatus.MATCHED) {
                couple.updateInfo(request.getGroomName(), request.getBrideName(),
                        request.getGroomNickname(), request.getBrideNickname(),
                        request.getGroomPhoto(), request.getBridePhoto());
            }
        }

        log.info("[User] 정보 수정 - userId: {}", userId);
        return UserEditResponse.of(user, couple);
    }

    @Override
    @Transactional
    public UserPreferenceResponse savePreference(Long userId, UserPreferenceRequest request) {
        if (!userRepository.existsById(userId)) {
            throw new NotFoundException("사용자를 찾을 수 없습니다.");
        }

        UserPreference preference = userPreferenceRepository.findByUserId(userId)
                .map(existing -> {
                    existing.update(
                            request.getWeddingDate(), request.getTotalBudget(),
                            request.getSdmBudget(), request.getHallBudget(),
                            request.getWeddingHallReserved(), request.getSdmReserved(),
                            request.getHallStyle(), request.getGuestCount(),
                            request.getPreferredRegions()
                    );
                    return existing;
                })
                .orElseGet(() -> userPreferenceRepository.save(
                        UserPreference.builder()
                                .userId(userId)
                                .weddingDate(request.getWeddingDate())
                                .totalBudget(request.getTotalBudget())
                                .sdmBudget(request.getSdmBudget())
                                .hallBudget(request.getHallBudget())
                                .weddingHallReserved(request.getWeddingHallReserved())
                                .sdmReserved(request.getSdmReserved())
                                .hallStyle(request.getHallStyle())
                                .guestCount(request.getGuestCount())
                                .preferredRegions(request.getPreferredRegions())
                                .build()
                ));

        log.info("[User] 선호도 저장 - userId: {}", userId);
        return UserPreferenceResponse.from(preference);
    }

    @Override
    public UserPreferenceResponse getPreference(Long userId) {
        UserPreference preference = userPreferenceRepository.findByUserId(userId)
                .orElseThrow(() -> new NotFoundException("선호도 정보를 찾을 수 없습니다."));

        log.info("[User] 선호도 조회 - userId: {}", userId);
        return UserPreferenceResponse.from(preference);
    }
}
