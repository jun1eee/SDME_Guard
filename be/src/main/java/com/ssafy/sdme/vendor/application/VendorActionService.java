package com.ssafy.sdme.vendor.application;

import com.ssafy.sdme._global.exception.NotFoundException;
import com.ssafy.sdme.chat.repository.CoupleChatMessageRepository;
import com.ssafy.sdme.vote.repository.VoteItemRepository;
import com.ssafy.sdme.reservation.domain.Reservation;
import com.ssafy.sdme.user.domain.User;
import com.ssafy.sdme.user.repository.UserRepository;
import com.ssafy.sdme.vendor.domain.Vendor;
import com.ssafy.sdme.vendor.domain.VendorReport;
import com.ssafy.sdme.vendor.domain.VendorShare;
import com.ssafy.sdme.vendor.dto.VendorShareResponse;
import com.ssafy.sdme.vendor.repository.VendorReportRepository;
import com.ssafy.sdme.vendor.repository.VendorRepository;
import com.ssafy.sdme.vendor.repository.VendorShareRepository;
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
public class VendorActionService {

    private final VendorShareRepository vendorShareRepository;
    private final VendorReportRepository vendorReportRepository;
    private final VendorRepository vendorRepository;
    private final UserRepository userRepository;
    private final CoupleChatMessageRepository chatMessageRepository;
    private final VoteItemRepository voteItemRepository;

    @Transactional
    public VendorShareResponse shareVendor(Long userId, Long vendorId, String message) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        if (user.getCoupleId() == null) {
            throw new NotFoundException("커플 매칭이 필요합니다.");
        }

        // PK로 못 찾으면 sourceId로 조회
        Long resolvedId = resolveVendorId(vendorId);

        if (vendorShareRepository.existsBySharedUserIdAndVendorIdAndDeletedAtIsNull(userId, resolvedId)) {
            throw new com.ssafy.sdme._global.exception.BadRequestException("이미 공유한 업체입니다.");
        }

        VendorShare share = VendorShare.builder()
                .coupleId(user.getCoupleId())
                .vendorId(resolvedId)
                .sharedUserId(userId)
                .message(message)
                .build();
        vendorShareRepository.save(share);

        Vendor vendor = vendorRepository.findById(resolvedId).orElse(null);
        log.info("[Vendor] 업체 공유 - userId: {}, vendorId: {} (resolved: {})", userId, vendorId, resolvedId);
        return VendorShareResponse.of(share, vendor);
    }

    @Transactional(readOnly = true)
    public List<VendorShareResponse> getSharedVendors(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        if (user.getCoupleId() == null) {
            throw new NotFoundException("커플 매칭이 필요합니다.");
        }

        List<VendorShare> shares = vendorShareRepository.findByCoupleIdAndDeletedAtIsNullOrderByCreatedAtDesc(user.getCoupleId());
        List<Long> vendorIds = shares.stream().map(VendorShare::getVendorId).distinct().toList();
        Map<Long, Vendor> vendorMap = resolveVendorMap(vendorIds);

        return shares.stream()
                .map(s -> VendorShareResponse.of(s, vendorMap.get(s.getVendorId())))
                .toList();
    }

    @Transactional
    public void unshareVendor(Long userId, Long vendorId) {
        Long resolvedId = resolveVendorId(vendorId);
        VendorShare share = vendorShareRepository.findBySharedUserIdAndVendorIdAndDeletedAtIsNull(userId, resolvedId)
                .orElseThrow(() -> new NotFoundException("공유한 업체를 찾을 수 없습니다."));
        share.softDelete();
        // 채팅 메시지도 삭제
        chatMessageRepository.deleteByVendorId(vendorId);
        // 투표 항목도 삭제
        voteItemRepository.deleteByVendorId(vendorId);
        log.info("[Vendor] 업체 공유 삭제 - userId: {}, vendorId: {}", userId, vendorId);
    }

    @Transactional
    public void reportVendor(Long userId, Long vendorId, String reason) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        VendorReport report = VendorReport.builder()
                .coupleId(user.getCoupleId() != null ? user.getCoupleId() : 0L)
                .vendorId(vendorId)
                .reason(reason)
                .build();
        vendorReportRepository.save(report);

        log.info("[Vendor] 업체 신고 - userId: {}, vendorId: {}", userId, vendorId);
    }

    @Transactional
    public void updateProgress(Long userId, Long vendorId, String progress) {
        // 진행 상태는 Reservation 테이블에서 관리
        log.info("[Vendor] 진행 상태 업데이트 - userId: {}, vendorId: {}, progress: {}", userId, vendorId, progress);
    }

    private Long resolveVendorId(Long vendorId) {
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
}
