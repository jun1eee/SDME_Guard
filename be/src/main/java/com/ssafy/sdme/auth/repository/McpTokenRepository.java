package com.ssafy.sdme.auth.repository;

import com.ssafy.sdme.auth.domain.McpToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface McpTokenRepository extends JpaRepository<McpToken, Long> {
    Optional<McpToken> findByToken(String token);
    Optional<McpToken> findFirstByUserId(Long userId);
    void deleteByUserId(Long userId);
}
