CREATE TABLE `settings_update` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`last_check_timestamp` integer,
	`auto_check_enabled` integer DEFAULT true NOT NULL
);
