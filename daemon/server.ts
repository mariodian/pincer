import { serve, type Server } from "bun";
import { sql } from "drizzle-orm";

import { daemonConfig } from "../src/shared/appConfig";
import { rowToCheck, rowToIncidentEvent } from "../src/shared/db-helpers";
import { logger } from "../src/shared/logger";
import { config } from "./config";
import { getDatabase } from "./db";
import { agents, checks, incidentEvents, stats } from "./schema";

type DaemonServer = Server<undefined>;

const VERSION = daemonConfig.version;
const startTime = Date.now();

function checkAuth(req: Request): boolean {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return false;
  return auth.slice(7) === config.secret;
}

function getNamespaceId(req: Request): string | null {
  return req.headers.get("x-namespace-id");
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

async function handleRequest(req: Request): Promise<Response> {
  if (!checkAuth(req)) {
    return errorResponse("Unauthorized", 401);
  }

  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  try {
    // GET /health
    if (method === "GET" && path === "/health") {
      return jsonResponse({
        status: "ok",
        version: VERSION,
        uptime: Math.floor((Date.now() - startTime) / 1000),
      });
    }

    // GET /agents
    if (method === "GET" && path === "/agents") {
      const namespaceId = getNamespaceId(req);
      if (!namespaceId) return errorResponse("Missing namespace", 400);

      const { db } = getDatabase();
      const rows = db
        .select()
        .from(agents)
        .where(sql`${agents.namespaceId} = ${namespaceId}`)
        .all();
      return jsonResponse(
        rows.map((r) => ({
          id: r.agentId,
          type: r.type,
          name: r.name,
          url: r.url,
          port: r.port,
          enabled: r.enabled,
          healthEndpoint: r.healthEndpoint,
          statusShape: r.statusShape,
          agentHash: r.agentHash,
        })),
      );
    }

    // PUT /agents
    if (method === "PUT" && path === "/agents") {
      const namespaceId = getNamespaceId(req);
      if (!namespaceId) return errorResponse("Missing namespace", 400);

      const body = (await req.json()) as Array<{
        id: number;
        type: string;
        name: string;
        url: string;
        port: number;
        enabled: boolean;
        healthEndpoint: string | null;
        statusShape: string | null;
        agentHash: string | null;
      }>;
      if (!Array.isArray(body)) {
        return errorResponse("Expected array of agents");
      }

      const { sqlite } = getDatabase();
      sqlite.run("BEGIN IMMEDIATE");
      try {
        for (const agent of body) {
          sqlite.run(
            `INSERT INTO agents (namespace_id, agent_id, agent_hash, type, name, url, port, enabled, health_endpoint, status_shape, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(namespace_id, agent_id) DO UPDATE SET
               agent_hash = excluded.agent_hash,
               type = excluded.type,
               name = excluded.name,
               url = excluded.url,
               port = excluded.port,
               enabled = excluded.enabled,
               health_endpoint = excluded.health_endpoint,
               status_shape = excluded.status_shape,
               updated_at = excluded.updated_at`,
            [
              namespaceId,
              agent.id,
              agent.agentHash ?? null,
              agent.type,
              agent.name,
              agent.url,
              agent.port,
              agent.enabled ? 1 : 0,
              agent.healthEndpoint ?? null,
              agent.statusShape ?? null,
              Date.now(),
              Date.now(),
            ],
          );
        }
        sqlite.run("COMMIT");
      } catch (err) {
        sqlite.run("ROLLBACK");
        throw err;
      }

      return jsonResponse({ updated: body.length });
    }

    // GET /checks?since=<ms>&cursor=<id>&limit=<n>
    if (method === "GET" && path === "/checks") {
      const namespaceId = getNamespaceId(req);
      if (!namespaceId) return errorResponse("Missing namespace", 400);

      const { db } = getDatabase();
      const since = parseInt(url.searchParams.get("since") || "0", 10);
      const cursor = parseInt(url.searchParams.get("cursor") || "0", 10);
      const limit = Math.min(
        parseInt(url.searchParams.get("limit") || "1000", 10),
        5000,
      );

      const rows = db
        .select()
        .from(checks)
        .where(
          sql`${checks.namespaceId} = ${namespaceId}
            AND (${cursor} = 0 OR ${checks.id} > ${cursor})
            AND (${since} = 0 OR ${checks.checkedAt} >= ${since})`,
        )
        .orderBy(checks.id)
        .limit(limit + 1)
        .all();

      const hasMore = rows.length > limit;
      const page = rows.slice(0, limit);
      const nextCursor = hasMore ? page[page.length - 1].id : null;

      return jsonResponse({
        checks: page.map(rowToCheck),
        nextCursor,
      });
    }

    // GET /stats?since=<ms>
    if (method === "GET" && path === "/stats") {
      const namespaceId = getNamespaceId(req);
      if (!namespaceId) return errorResponse("Missing namespace", 400);

      const { db } = getDatabase();
      const since = parseInt(url.searchParams.get("since") || "0", 10);
      const sinceSecs = Math.floor(since / 1000);

      const rows = db
        .select()
        .from(stats)
        .where(
          sql`${stats.namespaceId} = ${namespaceId} AND ${stats.hourTimestamp} >= ${sinceSecs}`,
        )
        .orderBy(stats.hourTimestamp)
        .all();

      return jsonResponse(rows);
    }

    // GET /incident-events?since=<ms>
    if (method === "GET" && path === "/incident-events") {
      const namespaceId = getNamespaceId(req);
      if (!namespaceId) return errorResponse("Missing namespace", 400);

      const { db } = getDatabase();
      const since = parseInt(url.searchParams.get("since") || "0", 10);

      const rows = db
        .select()
        .from(incidentEvents)
        .where(
          sql`${incidentEvents.namespaceId} = ${namespaceId} AND ${incidentEvents.eventAt} >= ${since}`,
        )
        .orderBy(incidentEvents.eventAt)
        .all();

      return jsonResponse(rows.map(rowToIncidentEvent));
    }

    // GET /open-incidents - return currently open incidents (no 'recovered' event)
    if (method === "GET" && path === "/open-incidents") {
      const namespaceId = getNamespaceId(req);
      if (!namespaceId) return errorResponse("Missing namespace", 400);

      const { db } = getDatabase();

      const openIncidents = db.all<{
        agentId: number;
        incidentId: string;
        openedAt: number;
      }>(sql`
          SELECT
            e1.agent_id as agentId,
            e1.incident_id as incidentId,
            e1.event_at as openedAt
          FROM incident_events e1
          WHERE e1.namespace_id = ${namespaceId}
          AND e1.event_type = 'opened'
          AND NOT EXISTS (
            SELECT 1 FROM incident_events e2
            WHERE e2.incident_id = e1.incident_id
            AND e2.event_type = 'recovered'
          )
        `);

      return jsonResponse(openIncidents);
    }

    return errorResponse("Not found", 404);
  } catch (error) {
    logger.error("server", "Request handler error", error);
    return errorResponse("Internal server error", 500);
  }
}

let server: DaemonServer | null = null;

export function startServer(): DaemonServer {
  server = serve({
    port: config.port,
    fetch: handleRequest,
  });

  logger.info("server", `HTTP server listening on port ${config.port}`);
  return server;
}

export function stopServer(): void {
  if (server) {
    server.stop();
    server = null;
  }
}
