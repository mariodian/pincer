PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_agents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`port` integer NOT NULL,
	`enabled` integer DEFAULT true,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
INSERT INTO `__new_agents`("id", "type", "name", "url", "port", "enabled", "created_at", "updated_at") SELECT "id", "type", "name", "url", "port", "enabled", "created_at", "updated_at" FROM `agents`;--> statement-breakpoint
DROP TABLE `agents`;--> statement-breakpoint
ALTER TABLE `__new_agents` RENAME TO `agents`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agent_id` integer NOT NULL,
	`hour_timestamp` integer NOT NULL,
	`total_checks` integer NOT NULL,
	`ok_count` integer NOT NULL,
	`offline_count` integer NOT NULL,
	`error_count` integer NOT NULL,
	`uptime_pct` real NOT NULL,
	`avg_response_ms` real NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_stats`("id", "agent_id", "hour_timestamp", "total_checks", "ok_count", "offline_count", "error_count", "uptime_pct", "avg_response_ms") SELECT "id", "agent_id", "hour_timestamp", "total_checks", "ok_count", "offline_count", "error_count", "uptime_pct", "avg_response_ms" FROM `stats`;--> statement-breakpoint
DROP TABLE `stats`;--> statement-breakpoint
ALTER TABLE `__new_stats` RENAME TO `stats`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_stats_agent_hour` ON `stats` (`agent_id`,`hour_timestamp`);--> statement-breakpoint
CREATE INDEX `idx_stats_hour` ON `stats` (`hour_timestamp`);