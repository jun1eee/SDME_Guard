package com.ssafy.sdme.vendor.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.ssafy.sdme._global.exception.BadRequestException;
import com.ssafy.sdme._global.exception.ForbiddenException;
import com.ssafy.sdme._global.exception.NotFoundException;
import com.ssafy.sdme.reservation.domain.Reservation;
import com.ssafy.sdme.reservation.repository.ReservationRepository;
import com.ssafy.sdme.user.domain.User;
import com.ssafy.sdme.user.repository.UserRepository;
import com.ssafy.sdme.vendor.domain.Vendor;
import com.ssafy.sdme.vendor.domain.VendorReview;
import com.ssafy.sdme.vendor.dto.VendorReviewRequest;
import com.ssafy.sdme.vendor.dto.VendorReviewResponse;
import com.ssafy.sdme.vendor.repository.VendorRepository;
import com.ssafy.sdme.vendor.repository.VendorReviewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class VendorReviewService {

    private final VendorRepository vendorRepository;
    private final VendorReviewRepository vendorReviewRepository;
    private final VendorDetailStore vendorDetailStore;
    private final UserRepository userRepository;
    private final ReservationRepository reservationRepository;

    @Transactional(readOnly = true)
    public List<VendorReviewResponse> getReviews(Long vendorId) {
        Vendor vendor = vendorRepository.findById(vendorId)
            .orElseThrow(() -> new NotFoundException("업체를 찾을 수 없습니다."));

        List<VendorReviewResponse> result = new ArrayList<>();

        // 크롤링 리뷰: VendorDetailStore에서 JSON 추출 (STUDIO/DRESS/MAKEUP)
        JsonNode detail = vendorDetailStore.findBySourceId(vendor.getSourceId());
        log.info("[ReviewDebug] vendorId={} sourceId={} detail={}", vendorId, vendor.getSourceId(), detail != null ? "FOUND (reviews:" + detail.path("reviews").size() + ")" : "NULL");
        if (detail != null) {
            for (JsonNode r : detail.path("reviews")) {
                String content = r.path("contents").asText(null);
                if (content == null || content.isBlank()) continue;
                result.add(new VendorReviewResponse(
                    null,
                    r.path("score").floatValue() / 2f,  // 0~10 → 0~5
                    r.path("name").asText(null),
                    content.replace("<br />", "\n").strip(),
                    r.path("date").asText(null)
                ));
            }
        }

        // 사용자 작성 리뷰: REVIEW 테이블
        vendorReviewRepository.findByVendorIdAndDeletedAtIsNullOrderByCreatedAtDesc(vendorId)
            .stream()
            .map(VendorReviewResponse::from)
            .forEach(result::add);

        return result;
    }

    @Transactional
    public VendorReviewResponse createReview(Long vendorId, Long userId, VendorReviewRequest request) {
        if (!vendorRepository.existsById(vendorId)) {
            throw new NotFoundException("업체를 찾을 수 없습니다.");
        }
        if (request.rating() == null || request.rating() < 1 || request.rating() > 5) {
            throw new BadRequestException("평점은 1~5 사이여야 합니다.");
        }

        User user = userRepository.findById(userId)
            .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        Long coupleId = user.getCoupleId();
        if (coupleId == null) {
            throw new ForbiddenException("커플 연결 후 리뷰를 작성할 수 있습니다.");
        }

        Reservation reservation = reservationRepository
            .findTopByCoupleIdAndVendorIdAndStatusNotOrderByCreatedAtDesc(
                coupleId, vendorId, Reservation.ReservationStatus.CANCELLED)
            .orElseThrow(() -> new ForbiddenException("예약 내역이 있는 업체만 리뷰를 작성할 수 있습니다."));

        if (vendorReviewRepository.existsByCoupleIdAndVendorIdAndDeletedAtIsNull(coupleId, vendorId)) {
            throw new BadRequestException("이미 리뷰를 작성한 업체입니다.");
        }

        VendorReview review = VendorReview.builder()
            .coupleId(coupleId)
            .vendorId(vendorId)
            .reservationId(reservation.getId())
            .rating(request.rating())
            .content(request.content())
            .build();

        return VendorReviewResponse.from(vendorReviewRepository.save(review));
    }
}
