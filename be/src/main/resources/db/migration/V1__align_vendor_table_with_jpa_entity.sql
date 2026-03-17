ALTER TABLE `VENDOR`
    MODIFY COLUMN `id` BIGINT NOT NULL AUTO_INCREMENT,
    MODIFY COLUMN `category` VARCHAR(30) NOT NULL,
    MODIFY COLUMN `rating` DOUBLE NOT NULL,
    MODIFY COLUMN `review_count` INT NOT NULL,
    CHANGE COLUMN `image` `image_url` VARCHAR(500) NOT NULL,
    CHANGE COLUMN `hashtag` `hashtags` TEXT NULL,
    MODIFY COLUMN `contact` VARCHAR(255) NULL;

ALTER TABLE `VENDOR`
    ADD COLUMN `source_id` BIGINT NULL AFTER `id`,
    ADD COLUMN `crawled_at` DATETIME NULL AFTER `contact`,
    ADD COLUMN `updated_at` DATETIME NULL AFTER `created_at`;

UPDATE `VENDOR`
SET
    `source_id` = COALESCE(`source_id`, `id`),
    `image_url` = COALESCE(`image_url`, ''),
    `price` = NULLIF(REGEXP_REPLACE(COALESCE(`price`, ''), '[^0-9]', ''), ''),
    `updated_at` = COALESCE(`updated_at`, `created_at`);

UPDATE `VENDOR`
SET `price` = '0'
WHERE `price` IS NULL;

ALTER TABLE `VENDOR`
    MODIFY COLUMN `source_id` BIGINT NOT NULL,
    MODIFY COLUMN `price` BIGINT NOT NULL,
    MODIFY COLUMN `updated_at` DATETIME NOT NULL;

ALTER TABLE `VENDOR`
    ADD CONSTRAINT `uk_vendor_source_id` UNIQUE (`source_id`);
