DELETE FROM incident_events
WHERE id NOT IN (
  SELECT MIN(id)
  FROM incident_events
  GROUP BY agent_id, incident_id, event_type, event_at
);

CREATE UNIQUE INDEX `uniq_incident_events` ON `incident_events` (`agent_id`,`incident_id`,`event_type`,`event_at`);