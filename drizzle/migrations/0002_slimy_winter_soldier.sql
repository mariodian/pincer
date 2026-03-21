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
DROP TABLE `stats`;
--> statement-breakpoint
ALTER TABLE `__new_stats` RENAME TO `stats`;
--> statement-breakpoint
CREATE INDEX `idx_stats_hour` ON `stats` (`hour_timestamp`);
