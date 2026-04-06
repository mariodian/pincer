-- Migration: Add app_meta table and change use_native_tray default to true (1)
-- Combines what was previously migrations 0011 and 0012

-- Create app_meta table for app state tracking (initialized, versions, etc.)
CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint

-- Change use_native_tray default from 0 (false) to 1 (true)
-- SQLite doesn't support ALTER COLUMN, so we recreate the table
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_settings_advanced` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`polling_interval` integer DEFAULT 30000 NOT NULL,
	`use_native_tray` integer DEFAULT true NOT NULL,
	`auto_check_enabled` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_settings_advanced`("id", "polling_interval", "use_native_tray", "auto_check_enabled") SELECT "id", "polling_interval", "use_native_tray", "auto_check_enabled" FROM `settings_advanced`;--> statement-breakpoint
DROP TABLE `settings_advanced`;--> statement-breakpoint
ALTER TABLE `__new_settings_advanced` RENAME TO `settings_advanced`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
