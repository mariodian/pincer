DELETE FROM incident_events
WHERE id NOT IN (
  SELECT MIN(id)
  FROM incident_events
  GROUP BY agent_id, incident_id, event_type, event_at
);
--> statement-breakpoint
-- BUGFIX 2026-05-03: Same issue as 0022 — missing statement-breakpoint delimiter
-- caused bun:sqlite prepare() to skip the CREATE UNIQUE INDEX. Existing
-- databases patched in dbInitService.
CREATE UNIQUE INDEX `uniq_incident_events` ON `incident_events` (`agent_id`,`incident_id`,`event_type`,`event_at`);