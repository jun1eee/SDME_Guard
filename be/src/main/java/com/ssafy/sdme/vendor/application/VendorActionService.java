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

        if (vendorShareRepository.existsBySharedUserIdAndVendorIdAndDeletedAtIsNull(userId, vendorId)) {
            throw new com.ssafy.sdme._global.exception.BadRequestException("이미 공유한 업체입니다.");
        }

        VendorShare share = VendorShare.builder()
                .coupleId(user.getCoupleId())
                .vendorId(vendorId)
                .sharedUserId(userId)
                .message(message)
                .build();
        vendorShareRepository.save(share);

        Vendor vendor = vendorRepository.findById(vendorId).orElse(null);
        log.info("[Vendor] 업체 공유 - userId: {}, vendorId: {}", userId, vendorId);
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
        Map<Long, Vendor> vendorMap = vendorRepository.findAllById(vendorIds)
                .stream().collect(Collectors.toMap(Vendor::getId, v -> v));

        return shares.stream()
                .map(s -> VendorShareResponse.of(s, vendorMap.get(s.getVendorId())))
                .toList();
    }

    @Transactional
    public void unshareVendor(Long userId, Long vendorId) {
        VendorShare share = vendorShareRepository.findBySharedUserIdAndVendorIdAndDeletedAtIsNull(userId, vendorId)
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
}
