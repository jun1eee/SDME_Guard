package com.ssafy.sdme.user.service;

import com.ssafy.sdme._global.exception.NotFoundException;
import com.ssafy.sdme.budget.domain.Budget;
import com.ssafy.sdme.budget.repository.BudgetRepository;
import com.ssafy.sdme.couple.domain.Couple;
import com.ssafy.sdme.couple.domain.CoupleStatus;
import com.ssafy.sdme.couple.repository.CoupleRepository;
import com.ssafy.sdme.schedule.domain.Schedule;
import com.ssafy.sdme.schedule.repository.ScheduleRepository;
import com.ssafy.sdme.user.domain.Role;
import com.ssafy.sdme.user.domain.User;
import com.ssafy.sdme.user.domain.UserPreference;
import com.ssafy.sdme.user.dto.request.UserSharedInfoRequest;
import com.ssafy.sdme.user.dto.request.UserEditRequest;
import com.ssafy.sdme.user.dto.request.UserPreferenceRequest;
import com.ssafy.sdme.user.dto.request.UserTastesRequest;
import com.ssafy.sdme.user.dto.response.UserEditResponse;
import com.ssafy.sdme.user.dto.response.UserPreferenceResponse;
import com.ssafy.sdme.user.dto.response.UserResponse;
import com.ssafy.sdme.user.repository.UserPreferenceRepository;
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
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final CoupleRepository coupleRepository;
    private final UserPreferenceRepository userPreferenceRepository;
    private final BudgetRepository budgetRepository;
    private final ScheduleRepository scheduleRepository;

    @Override
    public UserResponse getMyInfo(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        log.info("[User] 내 정보 조회 - userId: {}", userId);
        return UserResponse.of(user);
    }

    @Override
    @Transactional
    public UserEditResponse editUser(Long userId, UserEditRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        user.editInfo(request.getName(), request.getNickname());

        log.info("[User] 정보 수정 - userId: {}", userId);
        return UserEditResponse.of(user);
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

        // 결혼 예정일 → 일정 캘린더 upsert
        if (request.getWeddingDate() != null) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));
            String WEDDING_TITLE = "결혼식";
            Schedule existing = user.getCoupleId() != null
                    ? scheduleRepository.findByCoupleIdAndTitleAndDeletedAtIsNull(user.getCoupleId(), WEDDING_TITLE).orElse(null)
                    : scheduleRepository.findByUserIdAndTitleAndDeletedAtIsNull(userId, WEDDING_TITLE).orElse(null);
            if (existing != null) {
                existing.update(WEDDING_TITLE, request.getWeddingDate(), existing.getTime(),
                        existing.getLocation(), existing.getMemo(), existing.getCategory());
            } else {
                scheduleRepository.save(Schedule.builder()
                        .userId(userId)
                        .coupleId(user.getCoupleId())
                        .title(WEDDING_TITLE)
                        .date(request.getWeddingDate())
                        .category(Schedule.ScheduleCategory.HALL)
                        .source(Schedule.ScheduleSource.USER)
                        .build());
            }
            log.info("[User] 결혼식 일정 upsert - userId: {}, date: {}", userId, request.getWeddingDate());
        }

        log.info("[User] 선호도 저장 - userId: {}", userId);
        return UserPreferenceResponse.from(preference);
    }

    @Override
    public UserPreferenceResponse getPreference(Long userId) {
        UserPreference preference = userPreferenceRepository.findByUserId(userId)
                .orElse(null);

        if (preference == null) {
            log.info("[User] 선호도 없음 - userId: {}", userId);
            return UserPreferenceResponse.empty();
        }

        log.info("[User] 선호도 조회 - userId: {}", userId);
        return UserPreferenceResponse.from(preference);
    }

    @Override
    @Transactional
    public UserPreferenceResponse updateTastes(Long userId, UserTastesRequest request) {

        if (!userRepository.existsById(userId)) {
            throw new NotFoundException("사용자를 찾을 수 없습니다.");
        }

        UserPreference preference = userPreferenceRepository.findByUserId(userId)
                .orElseGet(() -> userPreferenceRepository.save(
                        UserPreference.builder()
                                .userId(userId)
                                .build()
                ));

        preference.updateTastes(request.getStyles(), request.getColors(),
                request.getMoods(), request.getFoods());
        userPreferenceRepository.save(preference);

        log.info("[User] 취향 수정 - userId: {}", userId);
        return UserPreferenceResponse.from(preference);
    }

    @Override
    public UserPreferenceResponse getPartnerPreference(Long userId) {
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

        Long partnerId = user.getRole() == Role.g ? couple.getBrideId() : couple.getGroomId();

        UserPreference preference = userPreferenceRepository.findByUserId(partnerId)
                .orElse(null);

        if (preference == null) {
            log.info("[User] 파트너 선호도 없음 - userId: {}, partnerId: {}", userId, partnerId);
            return UserPreferenceResponse.empty();
        }

        log.info("[User] 파트너 선호도 조회 - userId: {}, partnerId: {}", userId, partnerId);
        return UserPreferenceResponse.from(preference);
    }

    @Override
    @Transactional
    public UserPreferenceResponse updateSharedInfo(Long userId, UserSharedInfoRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        // 내 선호도 업데이트 (없으면 생성)
        UserPreference myPref = userPreferenceRepository.findByUserId(userId)
                .orElseGet(() -> userPreferenceRepository.save(
                        UserPreference.builder().userId(userId).build()
                ));
        myPref.updateSharedInfo(request.getWeddingDate(), request.getTotalBudget(), request.getGuestCount(), request.getPreferredRegions());
        userPreferenceRepository.save(myPref);

        // 커플 매칭 되어있으면 파트너도 동기화
        if (user.getCoupleId() != null) {
            Couple couple = coupleRepository.findById(user.getCoupleId()).orElse(null);
            if (couple != null && couple.getStatus() == CoupleStatus.MATCHED) {
                Long partnerId = user.getRole() == Role.g ? couple.getBrideId() : couple.getGroomId();
                UserPreference partnerPref = userPreferenceRepository.findByUserId(partnerId)
                        .orElseGet(() -> userPreferenceRepository.save(
                                UserPreference.builder().userId(partnerId).build()
                        ));
                partnerPref.updateSharedInfo(request.getWeddingDate(), request.getTotalBudget(), request.getGuestCount(), request.getPreferredRegions());
                userPreferenceRepository.save(partnerPref);
                log.info("[User] 추가 정보 커플 동기화 - userId: {}, partnerId: {}", userId, partnerId);
            }
        }

        // Budget 테이블도 동기화 (없으면 생성)
        if (user.getCoupleId() != null && request.getTotalBudget() != null) {
            Budget budget = budgetRepository.findByCoupleId(user.getCoupleId())
                    .orElseGet(() -> budgetRepository.save(Budget.builder()
                            .coupleId(user.getCoupleId())
                            .totalBudget(0)
                            .build()));
            budget.updateTotal(request.getTotalBudget() * 10000);
            log.info("[User] Budget 동기화 - coupleId: {}, totalBudget: {}", user.getCoupleId(), request.getTotalBudget() * 10000);
        }


        // 결혼 예정일 → 일정 캘린더 upsert (카테고리 없음)
        if (request.getWeddingDate() != null) {
            String WEDDING_TITLE = "결혼식";
            Schedule existing = user.getCoupleId() != null
                ? scheduleRepository.findByCoupleIdAndTitleAndDeletedAtIsNull(user.getCoupleId(), WEDDING_TITLE).orElse(null)
                : scheduleRepository.findByUserIdAndTitleAndDeletedAtIsNull(userId, WEDDING_TITLE).orElse(null);

            if (existing != null) {
                existing.update(WEDDING_TITLE, request.getWeddingDate(), existing.getTime(),
                        existing.getLocation(), existing.getMemo(), existing.getCategory());
            } else {
                scheduleRepository.save(Schedule.builder()
                        .userId(userId)
                        .coupleId(user.getCoupleId())
                        .title(WEDDING_TITLE)
                        .date(request.getWeddingDate())
                        .category(Schedule.ScheduleCategory.HALL)
                        .source(Schedule.ScheduleSource.USER)
                        .build());
            }
            log.info("[User] 결혼식 일정 upsert - userId: {}, date: {}", userId, request.getWeddingDate());
        }

        log.info("[User] 추가 정보 수정 - userId: {}", userId);
        return UserPreferenceResponse.from(myPref);
    }

    @Override
    @Transactional
    public String updateProfileImage(Long userId, MultipartFile file) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        // 파일 확장자 추출
        String originalFilename = file.getOriginalFilename();
        String ext = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            ext = originalFilename.substring(originalFilename.lastIndexOf("."));
        }

        // 고유 파일명 생성
        String filename = userId + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8) + ext;

        // 저장 경로 (로컬: 시스템 임시 디렉토리, 서버/Docker: /uploads)
        Path uploadDir;
        if (System.getProperty("os.name").toLowerCase().contains("win")) {
            uploadDir = Paths.get(System.getProperty("user.home"), "uploads", "profiles");
        } else {
            uploadDir = Paths.get("/uploads/profiles");
        }
        Path filePath = uploadDir.resolve(filename);

        try {
            Files.createDirectories(uploadDir);
            Files.copy(file.getInputStream(), filePath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            log.error("[User] 프로필 이미지 저장 실패 - userId: {}", userId, e);
            throw new RuntimeException("프로필 이미지 저장에 실패했습니다.", e);
        }

        // URL 설정 (nginx에서 /uploads/ 로 서빙)
        String imageUrl = "/uploads/profiles/" + filename;
        user.updateProfileImage(imageUrl);

        log.info("[User] 프로필 이미지 변경 - userId: {}, url: {}", userId, imageUrl);
        return imageUrl;
    }

    @Override
    @Transactional
    public void deleteProfileImage(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        String existingUrl = user.getProfileImage();
        if (existingUrl != null && existingUrl.startsWith("/uploads/")) {
            try {
                String filename = existingUrl.substring(existingUrl.lastIndexOf("/") + 1);
                Path uploadDir;
                if (System.getProperty("os.name").toLowerCase().contains("win")) {
                    uploadDir = Paths.get(System.getProperty("user.home"), "uploads", "profiles");
                } else {
                    uploadDir = Paths.get("/uploads/profiles");
                }
                Files.deleteIfExists(uploadDir.resolve(filename));
            } catch (IOException e) {
                log.warn("[User] 프로필 이미지 파일 삭제 실패 - userId: {}", userId, e);
            }
        }

        user.updateProfileImage(null);
        log.info("[User] 프로필 이미지 삭제 - userId: {}", userId);
    }
}
