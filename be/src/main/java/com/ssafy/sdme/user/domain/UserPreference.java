package com.ssafy.sdme.user.domain;

import com.ssafy.sdme._global.common.entity.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.util.List;

@Entity
@Table(name = "USER_PREFERENCE")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserPreference extends BaseTimeEntity {

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "wedding_date")
    private LocalDate weddingDate;

    @Column(name = "total_budget")
    private Integer totalBudget;

    @Column(name = "sdm_budget")
    private Integer sdmBudget;

    @Column(name = "hall_budget")
    private Integer hallBudget;

    @Column(name = "wedding_hall_reserved")
    private Boolean weddingHallReserved;

    @Column(name = "sdm_reserved")
    private Boolean sdmReserved;

    @Column(name = "hall_style", length = 100)
    private String hallStyle;

    @Column(name = "guest_count")
    private Integer guestCount;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "preferred_regions", columnDefinition = "json")
    private List<PreferredRegion> preferredRegions;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "styles", columnDefinition = "json")
    private List<String> styles;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "colors", columnDefinition = "json")
    private List<String> colors;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "moods", columnDefinition = "json")
    private List<String> moods;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "foods", columnDefinition = "json")
    private List<String> foods;

    @Builder
    public UserPreference(Long userId, LocalDate weddingDate, Integer totalBudget,
                          Integer sdmBudget, Integer hallBudget,
                          Boolean weddingHallReserved, Boolean sdmReserved,
                          String hallStyle, Integer guestCount,
                          List<PreferredRegion> preferredRegions,
                          List<String> styles, List<String> colors,
                          List<String> moods, List<String> foods) {
        this.userId = userId;
        this.weddingDate = weddingDate;
        this.totalBudget = totalBudget;
        this.sdmBudget = sdmBudget;
        this.hallBudget = hallBudget;
        this.weddingHallReserved = weddingHallReserved;
        this.sdmReserved = sdmReserved;
        this.hallStyle = hallStyle;
        this.guestCount = guestCount;
        this.preferredRegions = preferredRegions;
        this.styles = styles;
        this.colors = colors;
        this.moods = moods;
        this.foods = foods;
    }

    public void update(LocalDate weddingDate, Integer totalBudget,
                       Integer sdmBudget, Integer hallBudget,
                       Boolean weddingHallReserved, Boolean sdmReserved,
                       String hallStyle, Integer guestCount,
                       List<PreferredRegion> preferredRegions) {
        this.weddingDate = weddingDate;
        this.totalBudget = totalBudget;
        this.sdmBudget = sdmBudget;
        this.hallBudget = hallBudget;
        this.weddingHallReserved = weddingHallReserved;
        this.sdmReserved = sdmReserved;
        this.hallStyle = hallStyle;
        this.guestCount = guestCount;
        this.preferredRegions = preferredRegions;
    }

    public void updateSharedInfo(LocalDate weddingDate, Integer totalBudget,
                                 Integer guestCount, List<PreferredRegion> preferredRegions) {
        this.weddingDate = weddingDate;
        this.totalBudget = totalBudget;
        this.guestCount = guestCount;
        this.preferredRegions = preferredRegions;
    }

    public void updateTastes(List<String> styles, List<String> colors,
                             List<String> moods, List<String> foods) {
        this.styles = styles;
        this.colors = colors;
        this.moods = moods;
        this.foods = foods;
    }
}
