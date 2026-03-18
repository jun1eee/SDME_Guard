package com.ssafy.sdme.vote.repository;

import com.ssafy.sdme.vote.domain.Vote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VoteRepository extends JpaRepository<Vote, Long> {
    Optional<Vote> findByUserIdAndVoteItemId(Long userId, Long voteItemId);
    List<Vote> findByVoteItemIdIn(List<Long> voteItemIds);
}
