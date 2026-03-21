PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_stats` (
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
INSERT INTO `__new_stats`("agent_id", "hour_timestamp", "total_checks", "ok_count", "offline_count", "error_count", "uptime_pct", "avg_response_ms") SELECT "agent_id", "hour_timestamp", "total_checks", "ok_count", "offline_count", "error_count", "uptime_pct", "avg_response_ms" FROM `stats`;--> statement-breakpoint
DROP TABLE `stats`;--> statement-breakpoint
ALTER TABLE `__new_stats` RENAME TO `stats`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_stats_hour` ON `stats` (`hour_timestamp`);--> statement-breakpoint
ALTER TABLE `agents` ADD `health_endpoint` text;--> statement-breakpoint
ALTER TABLE `agents` ADD `status_shape` text;--> statement-breakpoint
UPDATE `agents` SET `type` = 'custom' WHERE `type` = 'generic';