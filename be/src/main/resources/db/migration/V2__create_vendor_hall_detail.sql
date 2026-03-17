DROP TABLE IF EXISTS `VENDOR_HALL_DETAIL`;

CREATE TABLE `VENDOR_HALL_DETAIL` (
    `id`             BIGINT       NOT NULL AUTO_INCREMENT,
    `vendor_id`      BIGINT       NOT NULL,
    `name`           VARCHAR(100) NOT NULL,
    `guest_min`      INT          NULL,
    `guest_max`      INT          NULL,
    `style`          ENUM('밝은', '어두운', '모던', '클래식') NULL,
    `meal_type`      ENUM('뷔페', '코스', '한정식') NULL,
    `ceremony_type`  ENUM('분리예식', '동시예식') NULL,
    `entrance_type`  ENUM('신부실에서바로', '계단을통해', '정면에서', 'ㄱ자', 'ㄴ자', 'ㄷ자') NULL,
    `has_subway`     TINYINT(1)   NOT NULL DEFAULT 0,
    `has_parking`    TINYINT(1)   NOT NULL DEFAULT 0,
    `has_valet`      TINYINT(1)   NOT NULL DEFAULT 0,
    `has_virgin_road` TINYINT(1)  NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    INDEX `idx_vendor_hall_detail_vendor_id` (`vendor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;