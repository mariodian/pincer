CREATE TABLE `agents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`port` integer NOT NULL,
	`enabled` integer DEFAULT true,
	`health_endpoint` text,
	`status_shape` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
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
CREATE TABLE `stats` (
	`agent_id` integer NOT NULL,
	`hour_timestamp` integer NOT NULL,
	`total_checks` integer NOT NULL,
	`ok_count` integer NOT NULL,
	`offline_count` integer NOT NULL,
	`error_count` integer NOT NULL,
	`uptime_pct` real NOT NULL,
	`avg_response_ms` real NOT NULL,
	PRIMARY KEY(`agent_id`, `hour_timestamp`)
);
--> statement-breakpoint
CREATE INDEX `idx_stats_hour` ON `stats` (`hour_timestamp`);