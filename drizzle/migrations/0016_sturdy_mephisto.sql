PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_settings_advanced` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`polling_interval` integer DEFAULT 15000 NOT NULL,
	`use_native_tray` integer DEFAULT true NOT NULL,
	`auto_check_update` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_settings_advanced`("id", "polling_interval", "use_native_tray", "auto_check_update") SELECT "id", "polling_interval", "use_native_tray", "auto_check_update" FROM `settings_advanced`;--> statement-breakpoint
DROP TABLE `settings_advanced`;--> statement-breakpoint
ALTER TABLE `__new_settings_advanced` RENAME TO `settings_advanced`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_settings_notifications` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`notifications_enabled` integer DEFAULT false NOT NULL,
	`notify_on_status_change` integer DEFAULT true NOT NULL,
	`notify_on_error` integer DEFAULT true NOT NULL,
	`status_change_threshold` integer DEFAULT 2 NOT NULL,
	`silent_notifications` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_settings_notifications`("id", "notifications_enabled", "notify_on_status_change", "notify_on_error", "status_change_threshold", "silent_notifications") SELECT "id", "notifications_enabled", "notify_on_status_change", "notify_on_error", "status_change_threshold", "silent_notifications" FROM `settings_notifications`;--> statement-breakpoint
DROP TABLE `settings_notifications`;--> statement-breakpoint
ALTER TABLE `__new_settings_notifications` RENAME TO `settings_notifications`;