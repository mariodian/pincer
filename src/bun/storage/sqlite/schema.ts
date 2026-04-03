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
  pollingInterval: integer("polling_interval").notNull().default(30000),
  retentionDays: integer("retention_days").notNull().default(90),
  openMainWindow: integer("open_main_window", { mode: "boolean" })
    .notNull()
    .default(true),
  showDisabledAgents: integer("show_disabled_agents", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const settingsUpdate = sqliteTable("settings_update", {
  id: integer("id").primaryKey().default(1),
  lastCheckTimestamp: integer("last_check_timestamp"),
  autoCheckEnabled: integer("auto_check_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
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
