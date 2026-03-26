package com.ssafy.sdme.chat.repository;

import com.ssafy.sdme.chat.domain.AiChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AiChatMessageRepository extends JpaRepository<AiChatMessage, Long> {

    List<AiChatMessage> findBySessionIdOrderByCreatedAtAsc(String sessionId);

    List<AiChatMessage> findByCoupleIdOrderByCreatedAtDesc(Long coupleId);

    List<AiChatMessage> findTop50ByCoupleIdOrderByCreatedAtDesc(Long coupleId);

    List<AiChatMessage> findTop50ByUserIdOrderByCreatedAtDesc(Long userId);

    List<AiChatMessage> findTop20BySessionIdOrderByCreatedAtDesc(String sessionId);

    void deleteBySessionId(String sessionId);
}
