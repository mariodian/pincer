-- Migration: Rename auto_check_enabled column to auto_check_update in settings_advanced
-- This aligns the database column name with the renamed TypeScript property

PRAGMA foreign_keys=OFF;--> statement-breakpoint

CREATE TABLE `__new_settings_advanced` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`polling_interval` integer DEFAULT 30000 NOT NULL,
	`use_native_tray` integer DEFAULT true NOT NULL,
	`auto_check_update` integer DEFAULT true NOT NULL
);--> statement-breakpoint

INSERT INTO `__new_settings_advanced`("id", "polling_interval", "use_native_tray", "auto_check_update")
SELECT "id", "polling_interval", "use_native_tray", "auto_check_enabled" FROM `settings_advanced`;--> statement-breakpoint

DROP TABLE `settings_advanced`;--> statement-breakpoint

ALTER TABLE `__new_settings_advanced` RENAME TO `settings_advanced`;--> statement-breakpoint

PRAGMA foreign_keys=ON;
