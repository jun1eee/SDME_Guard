package com.ssafy.sdme.vendor.application;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class VendorIdConverterTest {

    private final VendorIdConverter converter = new VendorIdConverter();

    // ── toSourceId: partnerId → sourceId ──

    @Test
    @DisplayName("studio: partnerId 17569 → sourceId 3017569")
    void toSourceId_studio() {
        assertThat(converter.toSourceId(17569L, "studio")).isEqualTo(3_017_569L);
    }

    @Test
    @DisplayName("dress: partnerId 1454 → sourceId 4001454")
    void toSourceId_dress() {
        assertThat(converter.toSourceId(1454L, "dress")).isEqualTo(4_001_454L);
    }

    @Test
    @DisplayName("makeup: partnerId 1835 → sourceId 5001835")
    void toSourceId_makeup() {
        assertThat(converter.toSourceId(1835L, "makeup")).isEqualTo(5_001_835L);
    }

    @Test
    @DisplayName("hall: prefix 없음, partnerId 그대로 반환")
    void toSourceId_hall() {
        assertThat(converter.toSourceId(747L, "hall")).isEqualTo(747L);
    }

    @Test
    @DisplayName("category null이면 partnerId 그대로 반환")
    void toSourceId_nullCategory() {
        assertThat(converter.toSourceId(12345L, null)).isEqualTo(12345L);
    }

    @Test
    @DisplayName("대소문자 무관: STUDIO → 30prefix")
    void toSourceId_caseInsensitive() {
        assertThat(converter.toSourceId(10590L, "STUDIO")).isEqualTo(3_010_590L);
    }

    // ── toPartnerId: sourceId → partnerId ──

    @Test
    @DisplayName("sourceId 3017569 → partnerId 17569")
    void toPartnerId_studio() {
        assertThat(converter.toPartnerId(3_017_569L)).isEqualTo(17_569L);
    }

    @Test
    @DisplayName("sourceId 4001454 → partnerId 1454")
    void toPartnerId_dress() {
        assertThat(converter.toPartnerId(4_001_454L)).isEqualTo(1454L);
    }

    @Test
    @DisplayName("sourceId 5001835 → partnerId 1835")
    void toPartnerId_makeup() {
        assertThat(converter.toPartnerId(5_001_835L)).isEqualTo(1835L);
    }

    @Test
    @DisplayName("sourceId 747 (hall) → 그대로 반환")
    void toPartnerId_hall() {
        assertThat(converter.toPartnerId(747L)).isEqualTo(747L);
    }
}
