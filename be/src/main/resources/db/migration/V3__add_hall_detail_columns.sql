ALTER TABLE `VENDOR_HALL_DETAIL`
    ADD COLUMN `hall_type`              VARCHAR(30)  NULL AFTER `name`,
    ADD COLUMN `meal_price`             INT          NULL AFTER `meal_type`,
    ADD COLUMN `ceremony_interval_min`  INT          NULL AFTER `ceremony_type`,
    ADD COLUMN `ceremony_interval_max`  INT          NULL AFTER `ceremony_interval_min`;
