CREATE TABLE `SCHEDULE` (
    `id`          INT           NOT NULL AUTO_INCREMENT,
    `user_id`     BIGINT        NOT NULL,
    `couple_id`   BIGINT        NULL,
    `title`       VARCHAR(200)  NOT NULL,
    `date`        DATE          NULL,
    `time`        TIME          NULL,
    `location`    VARCHAR(300)  NULL,
    `memo`        TEXT          NULL,
    `category`    ENUM('STUDIO', 'DRESS', 'MAKEUP', 'HALL')  NULL,
    `status`      ENUM('대기중', '진행중', '완료')             NOT NULL  DEFAULT '대기중',
    `created_at`  DATETIME      NOT NULL,
    `updated_at`  DATETIME      NOT NULL,
    `deleted_at`  DATETIME      NULL,
    `source`      ENUM('USER', 'AI')  NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_schedule_couple_id` (`couple_id`),
    INDEX `idx_schedule_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
