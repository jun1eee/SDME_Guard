package com.ssafy.sdme.vote.service;

import com.ssafy.sdme._global.exception.NotFoundException;
import com.ssafy.sdme.couple.domain.Couple;
import com.ssafy.sdme.couple.repository.CoupleRepository;
import com.ssafy.sdme.user.domain.Role;
import com.ssafy.sdme.user.domain.User;
import com.ssafy.sdme.user.repository.UserRepository;
import com.ssafy.sdme.vendor.domain.Vendor;
import com.ssafy.sdme.vendor.repository.VendorRepository;
import com.ssafy.sdme.vote.domain.Vote;
import com.ssafy.sdme.vote.domain.VoteItem;
import com.ssafy.sdme.vote.dto.VoteItemRequest;
import com.ssafy.sdme.vote.dto.VoteItemResponse;
import com.ssafy.sdme.vote.dto.VoteRequest;
import com.ssafy.sdme.vote.repository.VoteItemRepository;
import com.ssafy.sdme.vote.repository.VoteRepository;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class VoteService {

    private final VoteItemRepository voteItemRepository;
    private final VoteRepository voteRepository;
    private final UserRepository userRepository;
    private final VendorRepository vendorRepository;
    private final CoupleRepository coupleRepository;

    @Transactional
    public VoteItem createVoteItem(Long userId, VoteItemRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        if (user.getCoupleId() == null) {
            throw new NotFoundException("커플 매칭이 필요합니다.");
        }

        if (voteItemRepository.existsByCoupleIdAndVendorIdAndIsActiveTrue(user.getCoupleId(), request.getVendorId())) {
            throw new com.ssafy.sdme._global.exception.BadRequestException("이미 투표에 올라간 업체입니다.");
        }

        VoteItem.SourceType sourceType;
        try {
            sourceType = VoteItem.SourceType.valueOf(request.getSourceType());
        } catch (Exception e) {
            sourceType = VoteItem.SourceType.my_wish;
        }

        VoteItem item = VoteItem.builder()
                .vendorId(request.getVendorId())
                .sharedVendorId(request.getSharedVendorId() != null ? request.getSharedVendorId() : 0L)
                .coupleId(user.getCoupleId())
                .sourceType(sourceType)
                .createdByUserId(userId)
                .build();
        voteItemRepository.save(item);

        log.info("[Vote] 투표 항목 생성 - userId: {}, vendorId: {}", userId, request.getVendorId());
        return item;
    }

    @Transactional
    public Vote vote(Long userId, Long voteItemId, VoteRequest request) {
        VoteItem item = voteItemRepository.findById(voteItemId)
                .orElseThrow(() -> new NotFoundException("투표 항목을 찾을 수 없습니다."));

        Vote.VoteScore score;
        try {
            score = Vote.VoteScore.valueOf(request.getScore());
        } catch (Exception e) {
            score = Vote.VoteScore.neutral;
        }

        // 이미 투표했으면 수정
        Vote existing = voteRepository.findByUserIdAndVoteItemId(userId, voteItemId).orElse(null);
        if (existing != null) {
            existing.updateVote(score, request.getReason());
            log.info("[Vote] 투표 수정 - userId: {}, voteItemId: {}", userId, voteItemId);
            return existing;
        }

        Vote vote = Vote.builder()
                .userId(userId)
                .voteItemId(voteItemId)
                .score(score)
                .reason(request.getReason())
                .build();
        voteRepository.save(vote);

        log.info("[Vote] 투표 - userId: {}, voteItemId: {}, score: {}", userId, voteItemId, score);
        return vote;
    }

    @Transactional
    public void deleteVote(Long userId, Long voteItemId) {
        Vote vote = voteRepository.findByUserIdAndVoteItemId(userId, voteItemId)
                .orElseThrow(() -> new NotFoundException("투표를 찾을 수 없습니다."));
        voteRepository.delete(vote);
        log.info("[Vote] 투표 삭제 - userId: {}, voteItemId: {}", userId, voteItemId);
    }

    @Transactional
    public void deleteVoteItem(Long userId, Long voteItemId) {
        VoteItem item = voteItemRepository.findById(voteItemId)
                .orElseThrow(() -> new NotFoundException("투표 항목을 찾을 수 없습니다."));
        item.deactivate();
        log.info("[Vote] 투표 항목 삭제 - userId: {}, voteItemId: {}", userId, voteItemId);
    }

    @Transactional(readOnly = true)
    public List<VoteItemResponse> getVoteItems(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));

        if (user.getCoupleId() == null) {
            throw new NotFoundException("커플 매칭이 필요합니다.");
        }

        Couple couple = coupleRepository.findById(user.getCoupleId())
                .orElseThrow(() -> new NotFoundException("커플 정보를 찾을 수 없습니다."));

        Long partnerId = user.getRole() == Role.g ? couple.getBrideId() : couple.getGroomId();

        List<VoteItem> items = voteItemRepository.findByCoupleIdAndIsActiveTrueOrderByCreatedAtDesc(user.getCoupleId());
        List<Long> vendorIds = items.stream().map(VoteItem::getVendorId).distinct().toList();
        Map<Long, Vendor> vendorMap = vendorRepository.findAllById(vendorIds)
                .stream().collect(Collectors.toMap(Vendor::getId, v -> v));

        List<Long> itemIds = items.stream().map(VoteItem::getId).toList();
        List<Vote> allVotes = voteRepository.findByVoteItemIdIn(itemIds);
        Map<Long, Vote> myVoteMap = allVotes.stream()
                .filter(v -> v.getUserId().equals(userId))
                .collect(Collectors.toMap(Vote::getVoteItemId, v -> v));
        Map<Long, Vote> partnerVoteMap = allVotes.stream()
                .filter(v -> partnerId != null && v.getUserId().equals(partnerId))
                .collect(Collectors.toMap(Vote::getVoteItemId, v -> v));

        return items.stream()
                .map(item -> new VoteItemResponse(
                        item,
                        vendorMap.get(item.getVendorId()),
                        partnerVoteMap.containsKey(item.getId()),
                        myVoteMap.get(item.getId())
                ))
                .toList();
    }
}
