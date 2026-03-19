package com.ssafy.sdme.vote.repository;

import com.ssafy.sdme.vote.domain.VoteItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VoteItemRepository extends JpaRepository<VoteItem, Long> {
    List<VoteItem> findByCoupleIdAndIsActiveTrueOrderByCreatedAtDesc(Long coupleId);
    boolean existsByCoupleIdAndVendorIdAndIsActiveTrue(Long coupleId, Long vendorId);
    void deleteByVendorId(Long vendorId);
}
