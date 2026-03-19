package com.ssafy.sdme.chat.repository;

import com.ssafy.sdme.chat.domain.CoupleChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CoupleChatMessageRepository extends JpaRepository<CoupleChatMessage, Long> {

    List<CoupleChatMessage> findByCoupleChatRoomIdOrderByCreatedAtAsc(Long coupleChatRoomId);
    void deleteByVendorId(Long vendorId);
}
