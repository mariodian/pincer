import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const agents = sqliteTable("agents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  port: integer("port").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).default(true),
  healthEndpoint: text("health_endpoint"),
  statusShape: text("status_shape"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch())`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch())`,
  ),
});

export const settingsGeneral = sqliteTable("settings_general", {
  id: integer("id").primaryKey().default(1),
  retentionDays: integer("retention_days").notNull().default(90),
  openMainWindow: integer("open_main_window", { mode: "boolean" })
    .notNull()
    .default(true),
  showDisabledAgents: integer("show_disabled_agents", { mode: "boolean" })
    .notNull()
    .default(false),
  launchAtLogin: integer("launch_at_login", { mode: "boolean" })
    .notNull()
    .default(false),
});

// Advanced settings table - for settings shown in Advanced tab
export const settingsAdvanced = sqliteTable("settings_advanced", {
  id: integer("id").primaryKey().default(1),
  pollingInterval: integer("polling_interval").notNull().default(30000),
  useNativeTray: integer("use_native_tray", { mode: "boolean" })
    .notNull()
    .default(true),
  autoCheckUpdate: integer("auto_check_update", { mode: "boolean" })
    .notNull()
    .default(true),
});

// Notification settings table - for settings shown in Notifications tab
export const settingsNotifications = sqliteTable("settings_notifications", {
  id: integer("id").primaryKey().default(1),
  notificationsEnabled: integer("notifications_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  notifyOnStatusChange: integer("notify_on_status_change", { mode: "boolean" })
    .notNull()
    .default(true),
  notifyOnError: integer("notify_on_error", { mode: "boolean" })
    .notNull()
    .default(true),
  statusChangeThreshold: integer("status_change_threshold").notNull().default(1),
  silentNotifications: integer("silent_notifications", { mode: "boolean" })
    .notNull()
    .default(false),
});

// Key-value store for ephemeral application state (window position, UI state, etc.)
export const appState = sqliteTable("app_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch())`,
  ),
});

// Generic key-value store for app state (initialized, versions, migration flags, etc.)
export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(
    sql`(unixepoch())`,
  ),
});

export const stats = sqliteTable(
  "stats",
  {
    agentId: integer("agent_id").notNull(),
    hourTimestamp: integer("hour_timestamp").notNull(),
    totalChecks: integer("total_checks").notNull(),
    okCount: integer("ok_count").notNull(),
    offlineCount: integer("offline_count").notNull(),
    errorCount: integer("error_count").notNull(),
    uptimePct: real("uptime_pct").notNull(),
    avgResponseMs: real("avg_response_ms").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.agentId, table.hourTimestamp] }),
    index("idx_stats_hour").on(table.hourTimestamp),
  ],
);
