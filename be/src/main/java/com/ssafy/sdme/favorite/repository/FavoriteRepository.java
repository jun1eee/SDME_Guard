package com.ssafy.sdme.favorite.repository;

import com.ssafy.sdme.favorite.domain.Favorite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FavoriteRepository extends JpaRepository<Favorite, Long> {

    List<Favorite> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<Favorite> findByUserIdAndVendorId(Long userId, Long vendorId);

    boolean existsByUserIdAndVendorId(Long userId, Long vendorId);

    // 커플 전체 찜 (신랑 + 신부 모두)
    List<Favorite> findByCoupleIdOrderByCreatedAtDesc(Long coupleId);

    // 커플 찜목록: 같은 coupleId에서 신랑/신부 둘 다 찜한 vendorId
    @Query("SELECT f.vendorId FROM Favorite f WHERE f.coupleId = :coupleId GROUP BY f.vendorId HAVING COUNT(DISTINCT f.userId) >= 2")
    List<Long> findCoupleFavoriteVendorIds(@Param("coupleId") Long coupleId);
}
