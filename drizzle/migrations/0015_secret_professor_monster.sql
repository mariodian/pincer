CREATE TABLE `settings_notifications` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`notifications_enabled` integer DEFAULT false NOT NULL,
	`notify_on_status_change` integer DEFAULT true NOT NULL,
	`notify_on_error` integer DEFAULT true NOT NULL,
	`status_change_threshold` integer DEFAULT 1 NOT NULL,
	`silent_notifications` integer DEFAULT false NOT NULL
);
