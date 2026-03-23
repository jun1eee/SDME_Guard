package com.ssafy.sdme.vendor.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.ssafy.sdme._global.exception.BadRequestException;
import com.ssafy.sdme._global.exception.ForbiddenException;
import com.ssafy.sdme._global.exception.NotFoundException;
import com.ssafy.sdme.payment.domain.Payment;
import com.ssafy.sdme.payment.repository.PaymentRepository;
import com.ssafy.sdme.reservation.domain.Reservation;
import com.ssafy.sdme.reservation.repository.ReservationRepository;
import com.ssafy.sdme.user.domain.User;
import com.ssafy.sdme.user.repository.UserRepository;
import com.ssafy.sdme.vendor.domain.Vendor;
import com.ssafy.sdme.vendor.domain.VendorReview;
import com.ssafy.sdme.vendor.dto.MyReviewResponse;
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
    private final PaymentRepository paymentRepository;

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
            .map(review -> {
                String authorName;
                if (review.getUserId() != null) {
                    authorName = userRepository.findById(review.getUserId())
                        .map(u -> u.getNickname() != null && !u.getNickname().isBlank()
                            ? u.getNickname() : u.getName())
                        .orElse("익명");
                } else {
                    // user_id 없는 기존 리뷰: coupleId로 폴백
                    authorName = userRepository.findByCoupleId(review.getCoupleId())
                        .stream()
                        .map(u -> u.getNickname() != null && !u.getNickname().isBlank()
                            ? u.getNickname() : u.getName())
                        .filter(n -> n != null && !n.isBlank())
                        .findFirst()
                        .orElse("익명");
                }
                return VendorReviewResponse.from(review, authorName);
            })
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

        boolean hasDonePayment = paymentRepository
            .findByCoupleIdAndVendorIdOrderByRequestedAtDesc(coupleId, vendorId)
            .stream()
            .anyMatch(p -> p.getStatus() == Payment.PaymentStatus.DONE);
        if (!hasDonePayment) {
            throw new ForbiddenException("결제 완료 후 리뷰를 작성할 수 있습니다.");
        }

        if (vendorReviewRepository.existsByCoupleIdAndVendorIdAndDeletedAtIsNull(coupleId, vendorId)) {
            throw new BadRequestException("이미 리뷰를 작성한 업체입니다.");
        }

        VendorReview review = VendorReview.builder()
            .coupleId(coupleId)
            .userId(userId)
            .vendorId(vendorId)
            .reservationId(reservation.getId())
            .rating(request.rating())
            .content(request.content())
            .build();

        return VendorReviewResponse.from(vendorReviewRepository.save(review));
    }

    @Transactional(readOnly = true)
    public List<MyReviewResponse> getMyReviews(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        Long coupleId = user.getCoupleId();
        if (coupleId == null) {
            return List.of();
        }

        return vendorReviewRepository
            .findByCoupleIdAndDeletedAtIsNullOrderByCreatedAtDesc(coupleId)
            .stream()
            .map(review -> {
                Vendor vendor = vendorRepository.findById(review.getVendorId())
                    .orElseThrow(() -> new NotFoundException("업체를 찾을 수 없습니다."));
                return MyReviewResponse.from(review, vendor);
            })
            .toList();
    }

    @Transactional
    public VendorReviewResponse updateReview(Long reviewId, Long userId, VendorReviewRequest request) {
        if (request.rating() == null || request.rating() < 1 || request.rating() > 5) {
            throw new BadRequestException("평점은 1~5 사이여야 합니다.");
        }

        User user = userRepository.findById(userId)
            .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        Long coupleId = user.getCoupleId();
        if (coupleId == null) {
            throw new ForbiddenException("커플 연결 후 리뷰를 수정할 수 있습니다.");
        }

        VendorReview review = vendorReviewRepository.findById(reviewId)
            .orElseThrow(() -> new NotFoundException("리뷰를 찾을 수 없습니다."));

        if (review.getDeletedAt() != null) {
            throw new NotFoundException("리뷰를 찾을 수 없습니다.");
        }

        if (!review.getCoupleId().equals(coupleId)) {
            throw new ForbiddenException("본인의 리뷰만 수정할 수 있습니다.");
        }

        review.update(request.rating(), request.content());
        return VendorReviewResponse.from(review);
    }

    @Transactional
    public void deleteReview(Long reviewId, Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        Long coupleId = user.getCoupleId();
        if (coupleId == null) {
            throw new ForbiddenException("커플 연결 후 리뷰를 삭제할 수 있습니다.");
        }

        VendorReview review = vendorReviewRepository.findById(reviewId)
            .orElseThrow(() -> new NotFoundException("리뷰를 찾을 수 없습니다."));

        if (review.getDeletedAt() != null) {
            throw new NotFoundException("리뷰를 찾을 수 없습니다.");
        }

        if (!review.getCoupleId().equals(coupleId)) {
            throw new ForbiddenException("본인의 리뷰만 삭제할 수 있습니다.");
        }

        review.softDelete();
    }
}