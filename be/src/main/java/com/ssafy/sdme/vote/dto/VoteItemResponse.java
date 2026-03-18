package com.ssafy.sdme.vote.dto;

import com.ssafy.sdme.vendor.domain.Vendor;
import com.ssafy.sdme.vote.domain.Vote;
import com.ssafy.sdme.vote.domain.VoteItem;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class VoteItemResponse {
    private final Long id;
    private final Long vendorId;
    private final String vendorName;
    private final String category;
    private final Long price;
    private final Double rating;
    private final String imageUrl;
    private final String sourceType;
    private final Long createdByUserId;
    private final Boolean partnerVoted;
    private final String myScore;
    private final String myReason;
    private final LocalDateTime createdAt;

    public VoteItemResponse(VoteItem item, Vendor vendor, boolean partnerVoted, Vote myVote) {
        this.id = item.getId();
        this.vendorId = item.getVendorId();
        this.vendorName = vendor != null ? vendor.getName() : null;
        this.category = vendor != null ? vendor.getCategory() : null;
        this.price = vendor != null ? vendor.getPrice() : null;
        this.rating = vendor != null ? vendor.getRating() : null;
        this.imageUrl = vendor != null ? vendor.getImageUrl() : null;
        this.sourceType = item.getSourceType() != null ? item.getSourceType().name() : null;
        this.createdByUserId = item.getCreatedByUserId();
        this.partnerVoted = partnerVoted;
        this.myScore = myVote != null ? myVote.getScore().name() : null;
        this.myReason = myVote != null ? myVote.getReason() : null;
        this.createdAt = item.getCreatedAt();
    }
}
