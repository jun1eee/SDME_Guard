package com.ssafy.sdme.vendor.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.ssafy.sdme.vendor.domain.Vendor;
import com.ssafy.sdme.vendor.domain.VendorHallDetail;
import com.ssafy.sdme.vendor.repository.VendorHallDetailRepository;
import com.ssafy.sdme.vendor.repository.VendorRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
@DependsOn({"vendorCsvImporter", "hallDetailStore"})
@RequiredArgsConstructor
public class HallDetailImporter {

    private static final Pattern GUEST_SINGLE  = Pattern.compile("보증인원[:\\s]*(?:저녁\\s*)?(\\d+)명");
    private static final Pattern GUEST_RANGE   = Pattern.compile("보증인원[:\\s]*.*?(\\d+)명.*?~.*?(\\d+)명");
    private static final Pattern HALL_SECTION  = Pattern.compile("^💒(.+)$");

    private final VendorRepository vendorRepository;
    private final VendorHallDetailRepository vendorHallDetailRepository;
    private final HallDetailStore hallDetailStore;

    @PostConstruct
    @Transactional
    public void importIfEmpty() {
        // rentalPrice 컬럼 추가 후 기존 데이터 재임포트를 위해 전체 삭제 후 재삽입
        long existing = vendorHallDetailRepository.count();
        if (existing > 0) {
            vendorHallDetailRepository.deleteAll();
            log.info("Cleared {} existing hall details for re-import with rental prices", existing);
        }

        List<Vendor> halls = vendorRepository.findAllByCategory("HALL");
        int count = 0;
        for (Vendor vendor : halls) {
            JsonNode detail = hallDetailStore.findBySourceId(vendor.getSourceId());
            if (detail == null) continue;
            count += importOne(vendor, detail);
        }
        log.info("Imported hall details for {} vendors", count);
    }

    private int importOne(Vendor vendor, JsonNode detail) {
        String memoContent = detail.path("memoContent").asText(null);
        if (memoContent == null || memoContent.isBlank()) return 0;

        // 공통 정보: tags에서 추출
        JsonNode tags             = detail.path("tags");
        String sharedHallType     = extractHallTypeFromTags(tags);
        String sharedStyle        = extractStyleFromTags(tags);
        String sharedMealType     = extractMealTypeFromTags(tags);
        Integer sharedMealPrice   = extractMealPriceFromTags(tags);
        String sharedCeremonyType = extractCeremonyTypeFromTags(tags);
        Integer sharedIntervalMin = extractIntervalFromTags(tags, 13);
        Integer sharedIntervalMax = extractIntervalFromTags(tags, 14);

        // 크롤링된 홀별 대관료/식대 데이터
        JsonNode hallDetailsNode = detail.path("hallDetails");

        // 공통 정보: 체크리스트에서 추출
        boolean hasSubway  = memoContent.contains("역 도보") || memoContent.contains("역에서 도보");
        boolean hasParking = memoContent.contains("주차");
        boolean hasValet   = memoContent.contains("발렛");

        // 홀 방 섹션 파싱 (💒 으로 시작)
        List<HallSection> sections = parseHallSections(memoContent);
        if (sections.isEmpty()) {
            // 💒 섹션이 없으면 업체 전체를 단일 홀로 처리
            sections = List.of(new HallSection(vendor.getName(), memoContent));
        }

        List<VendorHallDetail> details = new ArrayList<>();
        for (int idx = 0; idx < sections.size(); idx++) {
            HallSection section = sections.get(idx);
            Integer[] guests = parseGuests(section.body());
            String style        = pickFirst(extractStyleFromText(section.body()), sharedStyle);
            String mealType     = pickFirst(extractMealTypeFromText(section.body()), sharedMealType);
            String ceremonyType = pickFirst(extractCeremonyTypeFromText(section.body()), sharedCeremonyType);

            // hallDetails에서 해당 홀의 대관료/식대 매칭
            Integer rentalPrice = null;
            Integer hallMealPrice = sharedMealPrice;
            JsonNode matched = matchHallDetail(hallDetailsNode, section.name(), idx);
            if (matched != null) {
                if (matched.has("rentalPrice") && matched.path("rentalPrice").asInt(0) > 0) {
                    rentalPrice = matched.path("rentalPrice").asInt();
                }
                if (matched.has("mealPrice") && matched.path("mealPrice").asInt(0) > 0) {
                    hallMealPrice = matched.path("mealPrice").asInt();
                }
            }

            details.add(VendorHallDetail.builder()
                .vendorId(vendor.getId())
                .name(section.name())
                .guestMin(guests[0])
                .guestMax(guests[1])
                .hallType(sharedHallType)
                .style(style)
                .mealType(mealType)
                .mealPrice(hallMealPrice)
                .rentalPrice(rentalPrice)
                .ceremonyType(ceremonyType)
                .ceremonyIntervalMin(sharedIntervalMin)
                .ceremonyIntervalMax(sharedIntervalMax)
                .entranceType(null)
                .hasSubway(hasSubway)
                .hasParking(hasParking)
                .hasValet(hasValet)
                .hasVirginRoad(false)
                .build());
        }

        vendorHallDetailRepository.saveAll(details);
        return 1;
    }

    /** hallDetails 배열에서 홀 이름으로 매칭, 없으면 인덱스로 매칭 */
    private JsonNode matchHallDetail(JsonNode hallDetailsNode, String hallName, int index) {
        if (hallDetailsNode == null || !hallDetailsNode.isArray() || hallDetailsNode.isEmpty()) return null;

        // 이름 매칭 (홀 이름이 포함되어 있는지)
        for (JsonNode node : hallDetailsNode) {
            String name = node.path("name").asText("");
            if (!name.isBlank() && (name.contains(hallName) || hallName.contains(name))) {
                return node;
            }
        }

        // 홀 이름에서 핵심 부분 추출해서 매칭 (예: "보르도홀 (LL층)" -> "보르도홀")
        String coreName = hallName.replaceAll("\\s*\\(.*\\)", "").trim();
        for (JsonNode node : hallDetailsNode) {
            String name = node.path("name").asText("");
            if (!name.isBlank() && (name.contains(coreName) || coreName.contains(name))) {
                return node;
            }
        }

        // 인덱스로 매칭
        if (index < hallDetailsNode.size()) {
            return hallDetailsNode.get(index);
        }
        return null;
    }

    // ── 홀 섹션 파싱 ────────────────────────────────────────────────────────

    private List<HallSection> parseHallSections(String memo) {
        List<HallSection> sections = new ArrayList<>();
        String[] lines = memo.split("[\\r\\n]+");

        String currentName = null;
        StringBuilder currentBody = new StringBuilder();

        for (String line : lines) {
            Matcher m = HALL_SECTION.matcher(line.trim());
            if (m.matches()) {
                if (currentName != null) {
                    sections.add(new HallSection(currentName, currentBody.toString()));
                }
                currentName = m.group(1).trim();
                currentBody = new StringBuilder();
            } else if (currentName != null) {
                currentBody.append(line).append("\n");
            }
        }
        if (currentName != null) {
            sections.add(new HallSection(currentName, currentBody.toString()));
        }
        return sections;
    }

    // ── 보증인원 파싱 ─────────────────────────────────────────────────────────

    private Integer[] parseGuests(String text) {
        Matcher range = GUEST_RANGE.matcher(text);
        if (range.find()) {
            int a = Integer.parseInt(range.group(1));
            int b = Integer.parseInt(range.group(2));
            return new Integer[]{Math.min(a, b), Math.max(a, b)};
        }
        Matcher single = GUEST_SINGLE.matcher(text);
        if (single.find()) {
            int v = Integer.parseInt(single.group(1));
            return new Integer[]{v, v};
        }
        return new Integer[]{null, null};
    }

    // ── 홀 타입 ───────────────────────────────────────────────────────────────

    private String extractHallTypeFromTags(JsonNode tags) {
        for (JsonNode tag : tags) {
            if (tag.path("type").asInt(-1) == 3) {
                String name = tag.path("name").asText("");
                // style 값이 아닌 경우만 hall type으로 취급
                if (!name.equals("밝은") && !name.equals("어두운") && !name.equals("모던") && !name.equals("클래식") && !name.isBlank()) {
                    return name;
                }
            }
        }
        return null;
    }

    // ── 식대 ──────────────────────────────────────────────────────────────────

    private Integer extractMealPriceFromTags(JsonNode tags) {
        for (JsonNode tag : tags) {
            if (tag.path("type").asInt(-1) == 5) {
                String name = tag.path("name").asText("");
                // "식대 75,900" → 75900
                String digits = name.replaceAll("[^0-9]", "");
                if (!digits.isBlank()) {
                    try { return Integer.parseInt(digits); } catch (NumberFormatException ignored) {}
                }
            }
        }
        return null;
    }

    // ── 예식간격 ──────────────────────────────────────────────────────────────

    private Integer extractIntervalFromTags(JsonNode tags, int targetType) {
        for (JsonNode tag : tags) {
            if (tag.path("type").asInt(-1) == targetType) {
                String name = tag.path("name").asText("").trim();
                if (!name.isBlank()) {
                    try { return Integer.parseInt(name); } catch (NumberFormatException ignored) {}
                }
            }
        }
        return null;
    }

    // ── 스타일 ─────────────────────────────────────────────────────────────────

    private String extractStyleFromText(String text) {
        if (text.contains("밝은")) return "밝은";
        if (text.contains("어두운")) return "어두운";
        if (text.contains("모던")) return "모던";
        if (text.contains("클래식")) return "클래식";
        return null;
    }

    private String extractStyleFromTags(JsonNode tags) {
        for (JsonNode tag : tags) {
            int type = tag.path("type").asInt(-1);
            if (type == 3) {
                String name = tag.path("name").asText("");
                if (name.equals("밝은") || name.equals("어두운") || name.equals("모던") || name.equals("클래식")) {
                    return name;
                }
            }
        }
        return null;
    }

    // ── 식사형태 ────────────────────────────────────────────────────────────────

    private String extractMealTypeFromText(String text) {
        if (text.contains("뷔페")) return "뷔페";
        if (text.contains("코스")) return "코스";
        if (text.contains("한정식")) return "한정식";
        return null;
    }

    private String extractMealTypeFromTags(JsonNode tags) {
        for (JsonNode tag : tags) {
            int type = tag.path("type").asInt(-1);
            if (type == 4) {
                String name = tag.path("name").asText("");
                if (name.equals("뷔페") || name.equals("코스") || name.equals("한정식")) {
                    return name;
                }
            }
        }
        return null;
    }

    // ── 예식형태 ────────────────────────────────────────────────────────────────

    private String extractCeremonyTypeFromText(String text) {
        if (text.contains("분리예식") || text.contains("분리")) return "분리예식";
        if (text.contains("동시예식") || text.contains("동시")) return "동시예식";
        return null;
    }

    private String extractCeremonyTypeFromTags(JsonNode tags) {
        for (JsonNode tag : tags) {
            int type = tag.path("type").asInt(-1);
            if (type == 15) {
                String name = tag.path("name").asText("");
                if (name.equals("분리")) return "분리예식";
                if (name.equals("동시")) return "동시예식";
            }
        }
        return null;
    }

    // ── 유틸 ────────────────────────────────────────────────────────────────────

    private String pickFirst(String a, String b) {
        return (a != null) ? a : b;
    }

    private record HallSection(String name, String body) {}
}
