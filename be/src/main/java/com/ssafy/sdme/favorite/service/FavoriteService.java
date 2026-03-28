package com.ssafy.sdme.favorite.service;

import com.ssafy.sdme._global.exception.BadRequestException;
import com.ssafy.sdme._global.exception.NotFoundException;
import com.ssafy.sdme.couple.domain.Couple;
import com.ssafy.sdme.couple.repository.CoupleRepository;
import com.ssafy.sdme.favorite.domain.Favorite;
import com.ssafy.sdme.favorite.dto.FavoriteResponse;
import com.ssafy.sdme.favorite.repository.FavoriteRepository;
import com.ssafy.sdme.user.domain.User;
import com.ssafy.sdme.user.repository.UserRepository;
import com.ssafy.sdme.vendor.domain.Vendor;
import com.ssafy.sdme.vendor.repository.VendorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class FavoriteService {

    private final FavoriteRepository favoriteRepository;
    private final UserRepository userRepository;
    private final VendorRepository vendorRepository;
    private final CoupleRepository coupleRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional(readOnly = true)
    public List<FavoriteResponse> getMyFavorites(Long userId) {
        List<Favorite> favorites = favoriteRepository.findByUserIdOrderByCreatedAtDesc(userId);
        List<Long> vendorIds = favorites.stream().map(Favorite::getVendorId).toList();
        Map<Long, Vendor> vendorMap = resolveVendorMap(vendorIds);

        return favorites.stream()
                .map(f -> FavoriteResponse.of(f, vendorMap.get(f.getVendorId())))
                .toList();
    }

    @Transactional
    public FavoriteResponse addFavorite(Long userId, Long vendorId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        if (user.getCoupleId() == null) {
            throw new BadRequestException("커플 매칭이 필요합니다.");
        }

        // PK로 못 찾으면 sourceId로 조회
        Long resolvedId = resolveVendorId(vendorId);

        if (favoriteRepository.existsByUserIdAndVendorId(userId, resolvedId)) {
            throw new BadRequestException("이미 찜한 업체입니다.");
        }

        Favorite favorite = Favorite.builder()
                .coupleId(user.getCoupleId())
                .vendorId(resolvedId)
                .userId(userId)
                .build();
        favoriteRepository.save(favorite);

        Vendor vendor = vendorRepository.findById(resolvedId).orElse(null);
        log.info("[Favorite] 찜 추가 - userId: {}, vendorId: {} (resolved: {})", userId, vendorId, resolvedId);
        notifyPartner(user);
        return FavoriteResponse.of(favorite, vendor);
    }

    @Transactional
    public void removeFavorite(Long userId, Long vendorId) {
        Long resolvedId = resolveVendorId(vendorId);
        Favorite favorite = favoriteRepository.findByUserIdAndVendorId(userId, resolvedId)
                .orElseThrow(() -> new NotFoundException("찜한 업체를 찾을 수 없습니다."));

        favoriteRepository.delete(favorite);
        log.info("[Favorite] 찜 해제 - userId: {}, vendorId: {}", userId, resolvedId);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));
        notifyPartner(user);
    }

    private void notifyPartner(User user) {
        if (user.getCoupleId() == null) return;
        coupleRepository.findById(user.getCoupleId()).ifPresent(couple -> {
            Long partnerId = user.getId().equals(couple.getGroomId())
                    ? couple.getBrideId()
                    : couple.getGroomId();
            if (partnerId == null) return;
            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("type", "FAVORITE_UPDATED");
            messagingTemplate.convertAndSend("/topic/couple/" + partnerId, (Object) payload);
            log.info("[Favorite] 파트너 찜 목록 갱신 알림 - partnerId: {}", partnerId);
        });
    }

    private Long resolveVendorId(Long vendorId) {
        // PK로 존재하면 그대로 사용, 없으면 sourceId로 조회
        if (vendorRepository.existsById(vendorId)) return vendorId;
        return vendorRepository.findBySourceId(vendorId)
                .map(Vendor::getId)
                .orElse(vendorId);
    }

    private Map<Long, Vendor> resolveVendorMap(List<Long> vendorIds) {
        Map<Long, Vendor> map = vendorRepository.findAllById(vendorIds)
                .stream().collect(Collectors.toMap(Vendor::getId, v -> v));
        List<Long> missing = vendorIds.stream().filter(id -> !map.containsKey(id)).distinct().toList();
        if (!missing.isEmpty()) {
            vendorRepository.findBySourceIdIn(missing)
                    .forEach(v -> map.put(v.getSourceId(), v));
        }
        return map;
    }

    @Transactional(readOnly = true)
    public List<FavoriteResponse> getAllCoupleFavorites(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        if (user.getCoupleId() == null) {
            throw new NotFoundException("커플 매칭이 되어있지 않습니다.");
        }

        List<Favorite> favorites = favoriteRepository.findByCoupleIdOrderByCreatedAtDesc(user.getCoupleId());
        List<Long> vendorIds = favorites.stream().map(Favorite::getVendorId).distinct().toList();
        Map<Long, Vendor> vendorMap = vendorRepository.findAllById(vendorIds)
                .stream().collect(Collectors.toMap(Vendor::getId, v -> v));

        return favorites.stream()
                .map(f -> FavoriteResponse.of(f, vendorMap.get(f.getVendorId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<FavoriteResponse> getCoupleFavorites(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        if (user.getCoupleId() == null) {
            throw new NotFoundException("커플 매칭이 되어있지 않습니다.");
        }

        List<Long> vendorIds = favoriteRepository.findCoupleFavoriteVendorIds(user.getCoupleId());
        Map<Long, Vendor> vendorMap = vendorRepository.findAllById(vendorIds)
                .stream().collect(Collectors.toMap(Vendor::getId, v -> v));

        log.info("[Favorite] 커플 찜목록 조회 - userId: {}, coupleId: {}, count: {}", userId, user.getCoupleId(), vendorIds.size());
        return vendorIds.stream()
                .map(id -> {
                    Vendor v = vendorMap.get(id);
                    return FavoriteResponse.of(
                            Favorite.builder().coupleId(user.getCoupleId()).vendorId(id).userId(userId).build(),
                            v
                    );
                })
                .toList();
    }
}
