-- Migration: Create settings_advanced table, move fields, drop settings_update

-- Create the new settings_advanced table
CREATE TABLE IF NOT EXISTS settings_advanced (
  id INTEGER PRIMARY KEY DEFAULT 1,
  polling_interval INTEGER NOT NULL DEFAULT 30000,
  use_native_tray INTEGER NOT NULL DEFAULT 0,
  auto_check_enabled INTEGER NOT NULL DEFAULT 1
);

-- Migrate data from existing tables
-- Insert row with values from settings_general (polling_interval, use_native_tray) 
-- and settings_update (auto_check_enabled)
INSERT INTO settings_advanced (id, polling_interval, use_native_tray, auto_check_enabled)
SELECT 
  1 as id,
  COALESCE((SELECT polling_interval FROM settings_general WHERE id = 1), 30000) as polling_interval,
  COALESCE((SELECT use_native_tray FROM settings_general WHERE id = 1), 0) as use_native_tray,
  COALESCE((SELECT auto_check_enabled FROM settings_update WHERE id = 1), 1) as auto_check_enabled
WHERE NOT EXISTS (SELECT 1 FROM settings_advanced WHERE id = 1);

-- Drop the old settings_update table
DROP TABLE IF EXISTS settings_update;

-- Recreate settings_general without polling_interval and use_native_tray
-- SQLite doesn't support DROP COLUMN, so we need to recreate the table
CREATE TABLE settings_general_new (
  id INTEGER PRIMARY KEY DEFAULT 1,
  retention_days INTEGER NOT NULL DEFAULT 90,
  open_main_window INTEGER NOT NULL DEFAULT 1,
  show_disabled_agents INTEGER NOT NULL DEFAULT 0
);

-- Copy existing data (only the columns we're keeping)
INSERT INTO settings_general_new (id, retention_days, open_main_window, show_disabled_agents)
SELECT 
  id,
  COALESCE(retention_days, 90) as retention_days,
  COALESCE(open_main_window, 1) as open_main_window,
  COALESCE(show_disabled_agents, 0) as show_disabled_agents
FROM settings_general;

-- Drop the old table and rename the new one
DROP TABLE settings_general;
ALTER TABLE settings_general_new RENAME TO settings_general;
