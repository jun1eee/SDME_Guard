CREATE TABLE `USER` (
    `id`            BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `couple_id`     BIGINT       NULL,
    `name`          VARCHAR(100) NULL,
    `kakao_id`      VARCHAR(100) NOT NULL UNIQUE,
    `nickname`      VARCHAR(100) NULL,
    `profile_image` VARCHAR(500) NULL,
    `role`          VARCHAR(255) NULL COMMENT 'g=신랑, b=신부',
    `deleted_at`    DATETIME     NULL,
    `created_at`    DATETIME     NOT NULL,
    `updated_at`    DATETIME     NOT NULL
);

CREATE TABLE `USER_PREFERENCE` (
    `id`                    BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `user_id`               BIGINT       NOT NULL,
    `wedding_date`          DATE         NULL,
    `total_budget`          INT          NULL,
    `sdm_budget`            INT          NULL,
    `hall_budget`           INT          NULL,
    `wedding_hall_reserved` TINYINT(1)   NULL,
    `sdm_reserved`          TINYINT(1)   NULL,
    `hall_style`            VARCHAR(100) NULL,
    `guest_count`           INT          NULL,
    `preferred_regions`     JSON         NULL,
    `styles`                JSON         NULL,
    `colors`                JSON         NULL,
    `moods`                 JSON         NULL,
    `foods`                 JSON         NULL,
    `created_at`            DATETIME     NOT NULL,
    `updated_at`            DATETIME     NOT NULL
);

-- ── 커플 ────────────────────────────────────────────────────

CREATE TABLE `COUPLE` (
    `id`           BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `groom_id`     BIGINT       NULL,
    `bride_id`     BIGINT       NULL,
    `wedding_date` DATE         NULL,
    `total_budget` INT          NULL,
    `connected_at` DATETIME     NULL,
    `status`       VARCHAR(255) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING, MATCHED, DISCONNECTED',
    `created_at`   DATETIME     NOT NULL,
    `updated_at`   DATETIME     NOT NULL
);

CREATE TABLE `COUPLE_INVITE` (
    `id`          BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `inviter_id`  BIGINT       NOT NULL,
    `accept_id`   BIGINT       NULL,
    `invite_code` VARCHAR(6)   NOT NULL,
    `status`      VARCHAR(255) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING, ACCEPTED, EXPIRED',
    `created_at`  DATETIME     NOT NULL,
    `expired_at`  DATETIME     NULL,
    `accepted_at` DATETIME     NULL
);

CREATE TABLE `couple_preferences` (
    `id`          BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `couple_id`   BIGINT       NOT NULL,
    `budget`      VARCHAR(100) NULL,
    `guest_count` VARCHAR(50)  NULL,
    `venue`       VARCHAR(100) NULL,
    `style`       TEXT         NULL,
    `colors`      TEXT         NULL,
    `mood`        TEXT         NULL,
    `food`        TEXT         NULL
);

-- ── 업체 ────────────────────────────────────────────────────

CREATE TABLE `VENDOR` (
    `id`           BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `source_id`    BIGINT       NOT NULL UNIQUE,
    `name`         VARCHAR(100) NOT NULL,
    `category`     VARCHAR(30)  NOT NULL COMMENT 'STUDIO, DRESS, MAKEUP, HALL',
    `rating`       DOUBLE       NOT NULL,
    `review_count` INT          NOT NULL,
    `image_url`    VARCHAR(500) NOT NULL,
    `description`  TEXT         NULL,
    `hashtags`     TEXT         NULL,
    `address`      VARCHAR(500) NULL,
    `price`        BIGINT       NOT NULL,
    `contact`      VARCHAR(255) NULL,
    `crawled_at`   DATETIME     NULL,
    `created_at`   DATETIME     NOT NULL,
    `updated_at`   DATETIME     NOT NULL
);

CREATE TABLE `VENDOR_IMAGE` (
    `id`        BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `vendor_id` BIGINT       NOT NULL,
    `image_url` VARCHAR(500) NOT NULL,
    `order_num` INT          NOT NULL
);

CREATE TABLE `VENDOR_PACKAGE` (
    `id`        BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `vendor_id` BIGINT       NOT NULL,
    `tab_name`  VARCHAR(100) NOT NULL,
    `price`     BIGINT       NULL
);

CREATE TABLE `VENDOR_PACKAGE_ITEM` (
    `id`         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `package_id` BIGINT       NOT NULL,
    `label`      VARCHAR(100) NULL,
    `value`      VARCHAR(200) NULL
);

CREATE TABLE `VENDOR_ADDITIONAL_PRODUCT` (
    `id`        BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `vendor_id` BIGINT       NOT NULL,
    `name`      VARCHAR(100) NOT NULL,
    `price`     VARCHAR(50)  NULL
);

CREATE TABLE `VENDOR_HALL_DETAIL` (
    `id`                    BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `vendor_id`             BIGINT       NOT NULL,
    `name`                  VARCHAR(100) NOT NULL,
    `hall_type`             VARCHAR(30)  NULL,
    `guest_min`             INT          NULL,
    `guest_max`             INT          NULL,
    `style`                 VARCHAR(10)  NULL,
    `meal_type`             VARCHAR(10)  NULL,
    `meal_price`            INT          NULL,
    `rental_price`          INT          NULL,
    `ceremony_type`         VARCHAR(10)  NULL,
    `ceremony_interval_min` INT          NULL,
    `ceremony_interval_max` INT          NULL,
    `entrance_type`         VARCHAR(20)  NULL,
    `has_subway`            TINYINT(1)   NOT NULL DEFAULT 0,
    `has_parking`           TINYINT(1)   NOT NULL DEFAULT 0,
    `has_valet`             TINYINT(1)   NOT NULL DEFAULT 0,
    `has_virgin_road`       TINYINT(1)   NOT NULL DEFAULT 0
);

CREATE TABLE `VENDOR_SHARE` (
    `id`             BIGINT   NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `couple_id`      BIGINT   NOT NULL,
    `vendor_id`      BIGINT   NOT NULL,
    `shared_user_id` BIGINT   NOT NULL,
    `message`        TEXT     NULL,
    `created_at`     DATETIME NULL,
    `shared_at`      DATETIME NULL,
    `deleted_at`     DATETIME NULL
);

CREATE TABLE `VENDOR_REPORT` (
    `id`         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `couple_id`  BIGINT       NOT NULL,
    `vendor_id`  BIGINT       NOT NULL,
    `reason`     TEXT         NOT NULL,
    `status`     VARCHAR(255) NULL DEFAULT 'PENDING' COMMENT 'PENDING, APPROVED, REJECTED',
    `created_at` DATETIME     NOT NULL
);

-- ── 리뷰 ────────────────────────────────────────────────────

CREATE TABLE `REVIEW` (
    `id`             BIGINT   NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `couple_id`      BIGINT   NOT NULL,
    `user_id`        BIGINT   NULL,
    `vendor_id`      BIGINT   NOT NULL,
    `reservation_id` BIGINT   NOT NULL,
    `rating`         FLOAT    NOT NULL COMMENT '1~5',
    `content`        TEXT     NULL,
    `created_at`     DATETIME NULL,
    `updated_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `deleted_at`     DATETIME NULL
);

-- ── 찜 ──────────────────────────────────────────────────────

CREATE TABLE `FAVORITE` (
    `id`         BIGINT   NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `couple_id`  BIGINT   NOT NULL,
    `vendor_id`  BIGINT   NOT NULL,
    `user_id`    BIGINT   NOT NULL,
    `created_at` DATETIME NOT NULL
);

-- ── 투표 ────────────────────────────────────────────────────

CREATE TABLE `VOTE_ITEMS` (
    `id`                 BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `vendor_id`          BIGINT       NOT NULL,
    `shared_vendor_id`   BIGINT       NOT NULL,
    `couple_id`          BIGINT       NOT NULL,
    `source_type`        VARCHAR(255) NULL COMMENT 'ai, my_wish, partner_share',
    `is_active`          TINYINT(1)   NULL DEFAULT 1,
    `created_at`         DATETIME     NULL,
    `deleted_at`         DATETIME     NULL,
    `created_by_user_id` BIGINT       NULL
);

CREATE TABLE `VOTES` (
    `id`            BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `user_id`       BIGINT       NOT NULL,
    `vote_items_id` BIGINT       NOT NULL,
    `score`         VARCHAR(255) NULL COMMENT 'great, good, neutral, bad, notinterested',
    `reason`        TEXT         NULL,
    `is_edited`     TINYINT(1)   NULL DEFAULT 0,
    `voted_at`      DATETIME     NULL,
    `updated_at`    DATETIME     NULL
);

-- ── 예산 ────────────────────────────────────────────────────

CREATE TABLE `BUDGET` (
    `id`           BIGINT   NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `couple_id`    BIGINT   NOT NULL,
    `total_budget` INT      NOT NULL,
    `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE `BUDGET_CATEGORY` (
    `id`        BIGINT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `budget_id` BIGINT      NOT NULL,
    `name`      VARCHAR(20) NOT NULL COMMENT '웨딩홀, 스튜디오, 드레스, 메이크업, 허니문, 기타',
    `allocated` INT         NOT NULL,
    `spent`     INT         NOT NULL DEFAULT 0
);

CREATE TABLE `BUDGET_ITEM` (
    `id`                 BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `budget_category_id` BIGINT       NOT NULL,
    `vendor_id`          BIGINT       NOT NULL,
    `name`               VARCHAR(100) NOT NULL,
    `amount`             INT          NOT NULL,
    `is_paid`            TINYINT(1)   NOT NULL DEFAULT 0,
    `created_at`         DATETIME     NOT NULL,
    `updated_at`         DATETIME     NULL
);

-- ── 일정 ────────────────────────────────────────────────────

CREATE TABLE `SCHEDULE` (
    `id`             BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `user_id`        BIGINT       NOT NULL,
    `couple_id`      BIGINT       NULL,
    `title`          VARCHAR(200) NOT NULL,
    `date`           DATE         NULL,
    `time`           TIME         NULL,
    `location`       VARCHAR(300) NULL,
    `memo`           TEXT         NULL,
    `category`       ENUM('STUDIO','DRESS','MAKEUP','HALL','ETC') NULL,
    `status`         ENUM('대기중','진행중','완료') NOT NULL DEFAULT '대기중',
    `source`         ENUM('USER','AI') NULL,
    `reservation_id` BIGINT       NULL,
    `created_at`     DATETIME     NOT NULL,
    `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `deleted_at`     DATETIME     NULL
);

-- ── 예약 ────────────────────────────────────────────────────

CREATE TABLE `RESERVATION` (
    `id`               BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `couple_id`        BIGINT       NOT NULL,
    `vendor_id`        BIGINT       NOT NULL,
    `hall_detail_id`   BIGINT       NOT NULL,
    `reservation_date` DATE         NULL,
    `service_date`     DATE         NULL,
    `reservation_time` TIME         NULL,
    `status`           VARCHAR(255) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING, CONFIRMED, CANCELLED',
    `progress`         VARCHAR(255) NULL DEFAULT 'CONSULTING' COMMENT 'CONSULTING, DEPOSIT_PAID, IN_PROGRESS, BALANCE_PAID, COMPLETED',
    `completed_at`     DATETIME     NULL,
    `memo`             TEXT         NULL,
    `created_at`       DATETIME     NOT NULL,
    `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 결제 ────────────────────────────────────────────────────

CREATE TABLE `CARD_INFORMATION` (
    `id`              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `user_id`         BIGINT       NOT NULL,
    `pg_provider`     VARCHAR(255) NULL,
    `customer_key`    VARCHAR(200) NULL,
    `billing_key`     VARCHAR(200) NULL,
    `method_provider` VARCHAR(100) NULL,
    `card_brand`      VARCHAR(100) NULL,
    `card_last4`      VARCHAR(4)   NULL,
    `owner_name`      VARCHAR(100) NULL,
    `created_at`      DATETIME     NULL,
    `updated_at`      DATETIME     NULL,
    `deleted_at`      DATETIME     NULL
);

CREATE TABLE `PAYMENT` (
    `id`                  BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `couple_id`           BIGINT       NOT NULL,
    `vendor_id`           BIGINT       NOT NULL,
    `reservation_id`      BIGINT       NOT NULL,
    `card_information_id` BIGINT       NOT NULL,
    `type`                VARCHAR(255) NOT NULL COMMENT 'DEPOSIT, BALANCE',
    `amount`              INT          NOT NULL,
    `status`              VARCHAR(255) NOT NULL DEFAULT 'READY' COMMENT 'READY, IN_PROGRESS, DONE, CANCELED, PARTIAL_CANCELED, ABORTED, EXPIRED',
    `date`                DATE         NULL,
    `pg_provider`         VARCHAR(255) NULL,
    `payment_key`         VARCHAR(200) NULL,
    `requested_at`        DATETIME     NOT NULL,
    `approved_at`         DATETIME     NULL
);

-- ── 채팅 ────────────────────────────────────────────────────

CREATE TABLE `COUPLE_CHAT_ROOMS` (
    `id`                  BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `couple_id`           BIGINT       NOT NULL,
    `ai_mode`             TINYINT(1)   NULL DEFAULT 0,
    `groom_ai_session_id` VARCHAR(100) NULL,
    `bride_ai_session_id` VARCHAR(100) NULL,
    `created_at`          DATETIME     NULL,
    `updated_at`          DATETIME     NULL
);

CREATE TABLE `COUPLE_CHAT_MESSAGES` (
    `id`                  BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `couple_chat_room_id` BIGINT       NOT NULL,
    `sender_user_id`      BIGINT       NOT NULL,
    `content`             TEXT         NULL,
    `message_type`        VARCHAR(255) NULL DEFAULT 'text' COMMENT 'text, vendor_share, vendor_recommendation, system, ai_response',
    `vendor_id`           BIGINT       NULL,
    `vendor_share_id`     BIGINT       NULL,
    `created_at`          DATETIME     NULL
);

CREATE TABLE `chat_history` (
    `id`         BIGINT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `couple_id`  BIGINT      NOT NULL,
    `role`       VARCHAR(20) NOT NULL COMMENT 'user, assistant',
    `content`    TEXT        NOT NULL,
    `intent`     VARCHAR(50) NULL,
    `created_at` DATETIME    NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE `AI_CHAT_MESSAGES` (
    `id`              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `couple_id`       BIGINT       NULL,
    `user_id`         BIGINT       NULL,
    `session_id`      VARCHAR(100) NOT NULL,
    `role`            VARCHAR(20)  NOT NULL COMMENT 'user, assistant',
    `content`         TEXT         NOT NULL,
    `recommendations` JSON         NULL,
    `created_at`      DATETIME     NOT NULL
);

-- ── 인증 / MCP ───────────────────────────────────────────────

CREATE TABLE `mcp_token` (
    `id`         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `user_id`    BIGINT       NOT NULL,
    `token`      VARCHAR(100) NOT NULL UNIQUE,
    `created_at` DATETIME     NOT NULL
);
