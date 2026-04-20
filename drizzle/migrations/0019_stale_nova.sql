-- Fix mixed data types in checks.checked_at column
-- Historical issue: Some values stored as TEXT (ISO dates) from Drizzle timestamp_ms mode,
-- while newer code stores INTEGER (ms timestamps). Convert all to INTEGER for consistent ordering.
UPDATE checks SET checked_at = CAST((julianday(checked_at) - julianday('1970-01-01')) * 86400000 AS INTEGER)
WHERE typeof(checked_at) = 'text';

-- Also fix any REAL values that may have been stored incorrectly
UPDATE checks SET checked_at = CAST(checked_at AS INTEGER)
WHERE typeof(checked_at) = 'real';
