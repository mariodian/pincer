CREATE TABLE `settings_daemon` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`secret` text DEFAULT '' NOT NULL
);
