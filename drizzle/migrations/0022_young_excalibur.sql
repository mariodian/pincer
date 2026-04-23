-- Clean up duplicate checks before adding UNIQUE constraint
-- This handles the case where HMR or multiple polling loops created duplicates
DELETE FROM checks 
WHERE rowid NOT IN (
  SELECT MIN(rowid) 
  FROM checks 
  GROUP BY agent_id, checked_at
);

-- Add UNIQUE constraint to prevent future duplicates
CREATE UNIQUE INDEX `uniq_checks_agent_time` ON `checks` (`agent_id`,`checked_at`);
