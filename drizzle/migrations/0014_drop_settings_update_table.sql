-- Migration: Drop orphaned settings_update table
-- This table was supposed to be dropped in migration 0009 but wasn't for some databases
-- The auto_check_enabled data was already migrated to settings_advanced
-- The last_check_timestamp was supposed to be migrated to app_state but may have been lost

DROP TABLE IF EXISTS settings_update;
