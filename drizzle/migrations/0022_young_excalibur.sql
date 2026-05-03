-- Clean up duplicate checks before adding UNIQUE constraint
-- This handles the case where HMR or multiple polling loops created duplicates
DELETE FROM checks 
WHERE rowid NOT IN (
  SELECT MIN(rowid) 
  FROM checks 
  GROUP BY agent_id, checked_at
);
--> statement-breakpoint
-- Add UNIQUE constraint to prevent future duplicates
-- BUGFIX 2026-05-03: The original version of this file was missing the
-- statement-breakpoint delimiter above, causing bun:sqlite prepare() to
-- silently skip the CREATE UNIQUE INDEX. Existing databases patched in
-- dbInitService.
CREATE UNIQUE INDEX `uniq_checks_agent_time` ON `checks` (`agent_id`,`checked_at`);
