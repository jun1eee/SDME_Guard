package com.ssafy.sdme.couple.repository;

import com.ssafy.sdme.couple.domain.CoupleInvite;
import com.ssafy.sdme.couple.domain.CoupleInviteStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CoupleInviteRepository extends JpaRepository<CoupleInvite, Long> {

    Optional<CoupleInvite> findByInviteCodeAndStatus(String inviteCode, CoupleInviteStatus status);

    Optional<CoupleInvite> findByInviterIdAndStatus(Long inviterId, CoupleInviteStatus status);
}
