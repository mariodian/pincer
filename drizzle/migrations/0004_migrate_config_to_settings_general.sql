CREATE TABLE `settings_general` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`polling_interval` integer DEFAULT 30000 NOT NULL,
	`retention_days` integer DEFAULT 90 NOT NULL,
	`open_main_window` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
INSERT INTO `settings_general` (`id`)
	SELECT 1 WHERE EXISTS (SELECT 1 FROM `config`);
--> statement-breakpoint
UPDATE `settings_general` SET
	`polling_interval` = COALESCE((SELECT CAST(`value` AS INTEGER) FROM `config` WHERE `key` = 'pollingInterval'), 30000),
	`retention_days` = COALESCE((SELECT CAST(`value` AS INTEGER) FROM `config` WHERE `key` = 'retentionDays'), 90),
	`open_main_window` = COALESCE((SELECT CASE WHEN `value` IN ('1', 'true') THEN 1 ELSE 0 END FROM `config` WHERE `key` = 'openMainWindow'), 1)
	WHERE EXISTS (SELECT 1 FROM `config`);
--> statement-breakpoint
DROP TABLE IF EXISTS `config`;