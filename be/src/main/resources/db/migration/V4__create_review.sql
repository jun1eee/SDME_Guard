CREATE TABLE IF NOT EXISTS `REVIEW` (
    `id`             BIGINT    NOT NULL AUTO_INCREMENT,
    `couple_id`      BIGINT    NOT NULL,
    `vendor_id`      BIGINT    NOT NULL,
    `reservation_id` BIGINT    NOT NULL,
    `rating`         FLOAT     NOT NULL COMMENT '1~5',
    `content`        TEXT      NULL,
    `created_at`     DATETIME  NULL,
    `updated_at`     DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `deleted_at`     DATETIME  NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_review_vendor_id` (`vendor_id`),
    INDEX `idx_review_couple_id` (`couple_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE REVIEW ADD COLUMN user_id BIGINT;
