package com.ssafy.sdme.vendor.application;

import com.ssafy.sdme.vendor.domain.Vendor;
import com.ssafy.sdme.vendor.repository.VendorRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class VendorCsvImporter {

    private static final String CSV_PATH = "data/vendor_halls.csv";
    private static final DateTimeFormatter CREATED_AT_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final VendorRepository vendorRepository;

    @PostConstruct
    @Transactional
    public void importIfEmpty() {
        if (vendorRepository.countByCategory("HALL") > 0) {
            log.info("Skip vendor CSV import: HALL data already exists.");
            return;
        }

        List<Vendor> vendors = readVendors();
        vendorRepository.saveAll(vendors);
        log.info("Imported {} vendors from {}", vendors.size(), CSV_PATH);
    }

    private List<Vendor> readVendors() {
        ClassPathResource resource = new ClassPathResource(CSV_PATH);
        if (!resource.exists()) {
            throw new IllegalStateException("CSV resource not found: " + CSV_PATH);
        }

        try (InputStream inputStream = resource.getInputStream();
             Reader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            List<List<String>> rows = parseRows(reader);
            if (rows.isEmpty()) {
                return List.of();
            }

            List<String> header = rows.getFirst();
            List<Vendor> vendors = new ArrayList<>();

            for (int i = 1; i < rows.size(); i++) {
                List<String> row = rows.get(i);
                if (row.stream().allMatch(String::isBlank)) {
                    continue;
                }
                Map<String, String> values = mapRow(header, row);
                vendors.add(toVendor(values));
            }

            return vendors;
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to read vendor CSV: " + CSV_PATH, exception);
        }
    }

    private Map<String, String> mapRow(List<String> header, List<String> row) {
        Map<String, String> values = new LinkedHashMap<>();
        for (int i = 0; i < header.size(); i++) {
            String key = header.get(i);
            String value = i < row.size() ? row.get(i) : "";
            values.put(key, value);
        }
        return values;
    }

    private Vendor toVendor(Map<String, String> values) {
        return Vendor.builder()
            .sourceId(parseLong(values.get("id"), 0L))
            .name(values.getOrDefault("name", ""))
            .category(values.getOrDefault("category", "HALL"))
            .rating(parseDouble(values.get("rating"), 0.0))
            .reviewCount(parseInteger(values.get("review_count"), 0))
            .imageUrl(values.getOrDefault("image", ""))
            .description(values.getOrDefault("description", ""))
            .hashtags(normalizeHashtags(values.get("hashtag")))
            .price(parseLong(values.get("price"), 0L))
            .contact(blankToNull(values.get("contact")))
            .crawledAt(parseDateTime(values.get("created_at")))
            .build();
    }

    private List<List<String>> parseRows(Reader reader) throws IOException {
        List<List<String>> rows = new ArrayList<>();
        List<String> currentRow = new ArrayList<>();
        StringBuilder currentValue = new StringBuilder();
        boolean inQuotes = false;

        int codePoint;
        boolean firstChar = true;
        while ((codePoint = reader.read()) != -1) {
            char current = (char) codePoint;
            if (firstChar) {
                firstChar = false;
                if (current == '\uFEFF') {
                    continue; // skip UTF-8 BOM
                }
            }

            if (current == '"') {
                if (inQuotes) {
                    reader.mark(1);
                    int nextCodePoint = reader.read();
                    if (nextCodePoint == '"') {
                        currentValue.append('"');
                    } else {
                        inQuotes = false;
                        if (nextCodePoint != -1) {
                            reader.reset();
                        }
                    }
                } else {
                    inQuotes = true;
                }
                continue;
            }

            if (current == ',' && !inQuotes) {
                currentRow.add(currentValue.toString());
                currentValue.setLength(0);
                continue;
            }

            if ((current == '\n' || current == '\r') && !inQuotes) {
                if (current == '\r') {
                    reader.mark(1);
                    int nextCodePoint = reader.read();
                    if (nextCodePoint != '\n' && nextCodePoint != -1) {
                        reader.reset();
                    }
                }

                currentRow.add(currentValue.toString());
                currentValue.setLength(0);
                rows.add(currentRow);
                currentRow = new ArrayList<>();
                continue;
            }

            currentValue.append(current);
        }

        if (!currentRow.isEmpty() || currentValue.length() > 0) {
            currentRow.add(currentValue.toString());
            rows.add(currentRow);
        }

        return rows;
    }

    private String normalizeHashtags(String hashtags) {
        if (hashtags == null || hashtags.isBlank()) {
            return "";
        }
        String normalized = hashtags.replace('\n', '|').replace('\r', '|');
        return normalized.trim();
    }

    private Long parseLong(String value, Long fallback) {
        try {
            return Long.parseLong(value.trim());
        } catch (Exception exception) {
            return fallback;
        }
    }

    private Integer parseInteger(String value, Integer fallback) {
        try {
            return Integer.parseInt(value.trim());
        } catch (Exception exception) {
            return fallback;
        }
    }

    private Double parseDouble(String value, Double fallback) {
        try {
            return Double.parseDouble(value.trim());
        } catch (Exception exception) {
            return fallback;
        }
    }

    private LocalDateTime parseDateTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value.trim(), CREATED_AT_FORMATTER);
        } catch (Exception exception) {
            return null;
        }
    }

    private String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
