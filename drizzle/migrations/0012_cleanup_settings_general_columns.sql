-- Migration: Remove orphaned columns from settings_general
-- These columns should only exist in settings_advanced but weren't properly removed
-- by migration 0009 for some databases

-- Check if columns exist and recreate table without them
PRAGMA foreign_keys=OFF;--> statement-breakpoint

-- Create new table with correct schema (only 5 columns)
CREATE TABLE `__new_settings_general` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`retention_days` integer DEFAULT 90 NOT NULL,
	`open_main_window` integer DEFAULT true NOT NULL,
	`show_disabled_agents` integer DEFAULT false NOT NULL,
	`launch_at_login` integer DEFAULT false NOT NULL
);--> statement-breakpoint

-- Copy only the columns we want to keep
INSERT INTO `__new_settings_general`("id", "retention_days", "open_main_window", "show_disabled_agents", "launch_at_login")
SELECT 
	"id",
	COALESCE("retention_days", 90) as "retention_days",
	COALESCE("open_main_window", 1) as "open_main_window",
	COALESCE("show_disabled_agents", 0) as "show_disabled_agents",
	COALESCE("launch_at_login", 0) as "launch_at_login"
FROM `settings_general`;--> statement-breakpoint

-- Drop old table and rename new one
DROP TABLE `settings_general`;--> statement-breakpoint
ALTER TABLE `__new_settings_general` RENAME TO `settings_general`;--> statement-breakpoint

PRAGMA foreign_keys=ON;
