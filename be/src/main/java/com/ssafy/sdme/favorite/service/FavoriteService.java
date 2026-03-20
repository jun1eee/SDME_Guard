package com.ssafy.sdme.favorite.service;

import com.ssafy.sdme._global.exception.BadRequestException;
import com.ssafy.sdme._global.exception.NotFoundException;
import com.ssafy.sdme.favorite.domain.Favorite;
import com.ssafy.sdme.favorite.dto.FavoriteResponse;
import com.ssafy.sdme.favorite.repository.FavoriteRepository;
import com.ssafy.sdme.user.domain.User;
import com.ssafy.sdme.user.repository.UserRepository;
import com.ssafy.sdme.vendor.domain.Vendor;
import com.ssafy.sdme.vendor.repository.VendorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @Transactional(readOnly = true)
    public List<FavoriteResponse> getMyFavorites(Long userId) {
        List<Favorite> favorites = favoriteRepository.findByUserIdOrderByCreatedAtDesc(userId);
        List<Long> vendorIds = favorites.stream().map(Favorite::getVendorId).toList();
        Map<Long, Vendor> vendorMap = vendorRepository.findAllById(vendorIds)
                .stream().collect(Collectors.toMap(Vendor::getId, v -> v));

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

        if (favoriteRepository.existsByUserIdAndVendorId(userId, vendorId)) {
            throw new BadRequestException("이미 찜한 업체입니다.");
        }

        Favorite favorite = Favorite.builder()
                .coupleId(user.getCoupleId())
                .vendorId(vendorId)
                .userId(userId)
                .build();
        favoriteRepository.save(favorite);

        Vendor vendor = vendorRepository.findById(vendorId).orElse(null);
        log.info("[Favorite] 찜 추가 - userId: {}, vendorId: {}", userId, vendorId);
        return FavoriteResponse.of(favorite, vendor);
    }

    @Transactional
    public void removeFavorite(Long userId, Long vendorId) {
        Favorite favorite = favoriteRepository.findByUserIdAndVendorId(userId, vendorId)
                .orElseThrow(() -> new NotFoundException("찜한 업체를 찾을 수 없습니다."));

        favoriteRepository.delete(favorite);
        log.info("[Favorite] 찜 해제 - userId: {}, vendorId: {}", userId, vendorId);
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
