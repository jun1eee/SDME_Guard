package com.ssafy.sdme.auth.jwt;

import com.ssafy.sdme._global.common.constant.ExpiredTime;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Slf4j
@Component
public class JwtUtil {

    private final SecretKey secretKey;

    public JwtUtil(@Value("${jwt.secret}") String secret) {
        this.secretKey = new SecretKeySpec(
                secret.getBytes(StandardCharsets.UTF_8),
                Jwts.SIG.HS256.key().build().getAlgorithm()
        );
    }

    public Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String createAccessToken(Long userId, String kakaoId, String role) {
        return Jwts.builder()
                .claim("category", "access")
                .claim("id", userId)
                .claim("kakaoId", kakaoId)
                .claim("role", role)
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + ExpiredTime.ACCESS_TOKEN_EXPIRED_TIME))
                .signWith(secretKey)
                .compact();
    }

    public String createRefreshToken(Long userId, String kakaoId, String role) {
        return Jwts.builder()
                .claim("category", "refresh")
                .claim("id", userId)
                .claim("kakaoId", kakaoId)
                .claim("role", role)
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + ExpiredTime.REFRESH_TOKEN_EXPIRED_TIME))
                .signWith(secretKey)
                .compact();
    }

    public Long getUserId(String token) {
        return extractAllClaims(token).get("id", Long.class);
    }

    public String getRole(String token) {
        return extractAllClaims(token).get("role", String.class);
    }

    public boolean isExpired(String token) {
        return extractAllClaims(token).getExpiration().before(new Date());
    }
}
