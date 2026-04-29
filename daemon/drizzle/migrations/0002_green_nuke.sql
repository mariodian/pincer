PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_agents` (
	`id` integer PRIMARY KEY NOT NULL,
	`namespace_id` text NOT NULL,
	`agent_id` integer NOT NULL,
	`agent_hash` text,
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
INSERT INTO `__new_agents`("id", "namespace_id", "agent_id", "agent_hash", "type", "name", "url", "port", "enabled", "health_endpoint", "status_shape", "created_at", "updated_at") SELECT "id", "namespace_id", "agent_id", "agent_hash", "type", "name", "url", "port", "enabled", "health_endpoint", "status_shape", "created_at", "updated_at" FROM `agents`;--> statement-breakpoint
DROP TABLE `agents`;--> statement-breakpoint
ALTER TABLE `__new_agents` RENAME TO `agents`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `agents_namespace_id_agent_id_unique` ON `agents` (`namespace_id`,`agent_id`);