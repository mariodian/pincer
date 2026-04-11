CREATE TABLE `checks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agent_id` integer NOT NULL,
	`checked_at` integer NOT NULL,
	`status` text NOT NULL,
	`response_ms` real,
	`http_status` integer,
	`error_code` text,
	`error_message` text
);
--> statement-breakpoint
CREATE INDEX `idx_checks_agent_time` ON `checks` (`agent_id`,`checked_at`);--> statement-breakpoint
CREATE INDEX `idx_checks_time` ON `checks` (`checked_at`);--> statement-breakpoint
CREATE TABLE `incident_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agent_id` integer NOT NULL,
	`incident_id` text NOT NULL,
	`event_at` integer NOT NULL,
	`event_type` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`reason` text
);
--> statement-breakpoint
CREATE INDEX `idx_incident_events_agent_incident` ON `incident_events` (`agent_id`,`incident_id`);--> statement-breakpoint
CREATE INDEX `idx_incident_events_time` ON `incident_events` (`event_at`);--> statement-breakpoint
ALTER TABLE `settings_notifications` ADD `failure_threshold` integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings_notifications` ADD `recovery_threshold` integer DEFAULT 2 NOT NULL;