-- Create app_state table for ephemeral application state
-- (window bounds, UI preferences, etc.)
CREATE TABLE `app_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch())
);
