package com.ssafy.sdme.auth.jwt;

import com.ssafy.sdme._global.common.constant.ErrorMessage;
import com.ssafy.sdme._global.exception.UnauthorizedException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthInterceptor implements HandlerInterceptor {

    private final JwtUtil jwtUtil;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        // OPTIONS 요청은 통과
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        // 업체 목록/상세 조회 (GET /api/vendors)는 인증 없이 허용
        String uri = request.getRequestURI();
        if ("GET".equalsIgnoreCase(request.getMethod()) && uri.startsWith("/api/vendors")
                && !uri.contains("/shared")) {
            // Authorization 헤더 있으면 토큰 파싱 시도 (userId 세팅), 없으면 통과
            String auth = request.getHeader("Authorization");
            if (auth == null || !auth.startsWith("Bearer ")) {
                return true;
            }
        }

        String authorization = request.getHeader("Authorization");

        if (authorization == null || !authorization.startsWith("Bearer ")) {
            log.warn("[Auth] Authorization 헤더가 없습니다. URI: {}", request.getRequestURI());
            throw new UnauthorizedException(ErrorMessage.NOT_FOUND_ACCESS_TOKEN);
        }

        String token = authorization.substring(7);

        try {
            Claims claims = jwtUtil.extractAllClaims(token);

            String category = claims.get("category", String.class);
            if (!"access".equals(category)) {
                throw new UnauthorizedException(ErrorMessage.NOT_ACCESS_TOKEN);
            }

            // request에 유저 정보 저장
            request.setAttribute("userId", claims.get("id", Long.class));
            request.setAttribute("role", claims.get("role", String.class));

            return true;

        } catch (ExpiredJwtException e) {
            log.warn("[Auth] 만료된 토큰입니다.");
            throw new UnauthorizedException(ErrorMessage.ACCESS_TOKEN_EXPIRED);

        } catch (JwtException e) {
            log.warn("[Auth] 유효하지 않은 토큰입니다: {}", e.getMessage());
            throw new UnauthorizedException(ErrorMessage.INVALID_ACCESS_TOKEN);
        }
    }
}
