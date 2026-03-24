package com.ssafy.sdme.auth.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "mcp_token")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class McpToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false, unique = true, length = 100)
    private String token;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Builder
    public McpToken(Long userId) {
        this.userId = userId;
        this.token = "sdm_mcp_" + UUID.randomUUID().toString().replace("-", "");
        this.createdAt = LocalDateTime.now();
    }
}
