import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const agents = sqliteTable("agents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  namespaceId: text("namespace_id").notNull(),
  agentId: integer("agent_id").notNull(),
  agentHash: text("agent_hash"),
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
}, (table) => [
  unique().on(table.namespaceId, table.agentId),
]);

export const checks = sqliteTable(
  "checks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    namespaceId: text("namespace_id").notNull(),
    agentId: integer("agent_id").notNull(),
    checkedAt: integer("checked_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status").notNull(),
    responseMs: real("response_ms"),
    httpStatus: integer("http_status"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("idx_checks_ns_agent_time").on(table.namespaceId, table.agentId, table.checkedAt),
    index("idx_checks_time").on(table.checkedAt),
  ],
);

export const stats = sqliteTable(
  "stats",
  {
    namespaceId: text("namespace_id").notNull(),
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
    primaryKey({ columns: [table.namespaceId, table.agentId, table.hourTimestamp] }),
    index("idx_stats_ns_agent").on(table.namespaceId, table.agentId),
    index("idx_stats_hour").on(table.hourTimestamp),
  ],
);

export const incidentEvents = sqliteTable(
  "incident_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    namespaceId: text("namespace_id").notNull(),
    agentId: integer("agent_id").notNull(),
    incidentId: text("incident_id").notNull(),
    linkedIncidentId: text("linked_incident_id"),
    eventAt: integer("event_at", { mode: "timestamp_ms" }).notNull(),
    eventType: text("event_type").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    reason: text("reason"),
  },
  (table) => [
    index("idx_incident_events_ns_agent").on(table.namespaceId, table.agentId),
    index("idx_incident_events_agent_incident").on(
      table.agentId,
      table.incidentId,
    ),
    index("idx_incident_events_time").on(table.eventAt),
  ],
);
