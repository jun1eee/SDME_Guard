package com.ssafy.sdme.chat.repository;

import com.ssafy.sdme.chat.domain.CoupleChatRoom;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CoupleChatRoomRepository extends JpaRepository<CoupleChatRoom, Long> {

    Optional<CoupleChatRoom> findByCoupleId(Long coupleId);
}
