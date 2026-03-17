package com.ssafy.sdme.vendor.repository;

import com.ssafy.sdme.vendor.dto.VendorSummary;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;

@Repository
@RequiredArgsConstructor
public class VendorCursorRepository {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public List<VendorSummary> find(
        String category, String keyword,
        Long minPrice, Long maxPrice, Double minRating,
        String sort, String cursor, int limit
    ) {
        DecodedCursor cv = DecodedCursor.from(cursor);
        String normalized = normalizeSort(sort);

        StringBuilder sql = new StringBuilder(
            "WITH filtered AS (" +
            "  SELECT *, ROW_NUMBER() OVER (PARTITION BY name, category ORDER BY price ASC, id ASC) AS rn" +
            "  FROM vendor WHERE 1=1"
        );
        MapSqlParameterSource params = new MapSqlParameterSource();

        if (category != null && !category.isBlank()) {
            sql.append(" AND category = :category");
            params.addValue("category", category.trim());
        }
        if (keyword != null && !keyword.isBlank()) {
            sql.append(" AND (name LIKE :keyword OR description LIKE :keyword OR hashtags LIKE :keyword)");
            params.addValue("keyword", "%" + keyword.trim() + "%");
        }
        if (minPrice != null) {
            sql.append(" AND price >= :minPrice");
            params.addValue("minPrice", minPrice);
        }
        if (maxPrice != null) {
            sql.append(" AND price <= :maxPrice");
            params.addValue("maxPrice", maxPrice);
        }
        if (minRating != null) {
            sql.append(" AND rating >= :minRating");
            params.addValue("minRating", minRating);
        }

        sql.append(") SELECT id, source_id, name, category, rating, review_count, image_url, description, hashtags, price, contact" +
                   " FROM filtered WHERE rn = 1");

        if (cv != null) {
            switch (normalized) {
                case "rating"    -> sql.append(" AND (rating < :cv OR (rating = :cv AND id < :cid))");
                case "priceasc"  -> sql.append(" AND (price > :cv OR (price = :cv AND id > :cid))");
                case "pricedesc" -> sql.append(" AND (price < :cv OR (price = :cv AND id < :cid))");
                default          -> sql.append(" AND (review_count < :cv OR (review_count = :cv AND id < :cid))");
            }
            params.addValue("cv", cv.value());
            params.addValue("cid", cv.id());
        }

        switch (normalized) {
            case "rating"    -> sql.append(" ORDER BY rating DESC, id DESC");
            case "priceasc"  -> sql.append(" ORDER BY price ASC, id ASC");
            case "pricedesc" -> sql.append(" ORDER BY price DESC, id DESC");
            default          -> sql.append(" ORDER BY review_count DESC, id DESC");
        }

        sql.append(" LIMIT :limit");
        params.addValue("limit", limit);

        return jdbcTemplate.query(sql.toString(), params, this::mapRow);
    }

    private VendorSummary mapRow(ResultSet rs, int rowNum) throws SQLException {
        String raw = rs.getString("hashtags");
        List<String> hashtags = (raw == null || raw.isBlank()) ? List.of() :
            Arrays.stream(raw.split("\\|")).map(String::trim).filter(s -> !s.isEmpty()).toList();

        return new VendorSummary(
            rs.getLong("id"),
            rs.getLong("source_id"),
            rs.getString("name"),
            rs.getString("category"),
            rs.getDouble("rating"),
            rs.getInt("review_count"),
            rs.getString("image_url"),
            rs.getString("description"),
            hashtags,
            rs.getLong("price"),
            rs.getString("contact")
        );
    }

    private static String normalizeSort(String sort) {
        return sort == null ? "default" : sort.trim().toLowerCase();
    }

    public record DecodedCursor(double value, long id) {
        static DecodedCursor from(String encoded) {
            if (encoded == null || encoded.isBlank()) return null;
            try {
                String raw = new String(Base64.getDecoder().decode(encoded), StandardCharsets.UTF_8);
                String[] parts = raw.split(":");
                return new DecodedCursor(Double.parseDouble(parts[0]), Long.parseLong(parts[1]));
            } catch (Exception e) {
                return null;
            }
        }
    }
}
