CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`port` integer NOT NULL,
	`enabled` integer DEFAULT true,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agent_id` text NOT NULL,
	`hour_timestamp` integer NOT NULL,
	`total_checks` integer NOT NULL,
	`ok_count` integer NOT NULL,
	`offline_count` integer NOT NULL,
	`error_count` integer NOT NULL,
	`uptime_pct` real NOT NULL,
	`avg_response_ms` real NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_stats_agent_hour` ON `stats` (`agent_id`,`hour_timestamp`);--> statement-breakpoint
CREATE INDEX `idx_stats_hour` ON `stats` (`hour_timestamp`);