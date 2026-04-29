DROP INDEX `idx_checks_agent_time`;--> statement-breakpoint
ALTER TABLE `checks` ADD `namespace_id` text NOT NULL DEFAULT 'default';--> statement-breakpoint
CREATE INDEX `idx_checks_ns_agent_time` ON `checks` (`namespace_id`,`agent_id`,`checked_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_stats` (
	`namespace_id` text NOT NULL DEFAULT 'default',
	`agent_id` integer NOT NULL,
	`hour_timestamp` integer NOT NULL,
	`total_checks` integer NOT NULL,
	`ok_count` integer NOT NULL,
	`offline_count` integer NOT NULL,
	`error_count` integer NOT NULL,
	`uptime_pct` real NOT NULL,
	`avg_response_ms` real NOT NULL,
	PRIMARY KEY(`namespace_id`, `agent_id`, `hour_timestamp`)
);
--> statement-breakpoint
INSERT INTO `__new_stats`("namespace_id", "agent_id", "hour_timestamp", "total_checks", "ok_count", "offline_count", "error_count", "uptime_pct", "avg_response_ms") SELECT 'default', "agent_id", "hour_timestamp", "total_checks", "ok_count", "offline_count", "error_count", "uptime_pct", "avg_response_ms" FROM `stats`;--> statement-breakpoint
DROP TABLE `stats`;--> statement-breakpoint
ALTER TABLE `__new_stats` RENAME TO `stats`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_stats_ns_agent` ON `stats` (`namespace_id`,`agent_id`);--> statement-breakpoint
CREATE INDEX `idx_stats_hour` ON `stats` (`hour_timestamp`);--> statement-breakpoint
ALTER TABLE `agents` ADD `namespace_id` text NOT NULL DEFAULT 'default';--> statement-breakpoint
ALTER TABLE `agents` ADD `agent_id` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `agents` ADD `agent_hash` text;--> statement-breakpoint
UPDATE `agents` SET `agent_id` = `id` WHERE `agent_id` = 0;--> statement-breakpoint
CREATE UNIQUE INDEX `agents_namespace_id_agent_id_unique` ON `agents` (`namespace_id`,`agent_id`);--> statement-breakpoint
ALTER TABLE `incident_events` ADD `namespace_id` text NOT NULL DEFAULT 'default';--> statement-breakpoint
ALTER TABLE `incident_events` ADD `linked_incident_id` text;--> statement-breakpoint
CREATE INDEX `idx_incident_events_ns_agent` ON `incident_events` (`namespace_id`,`agent_id`);
