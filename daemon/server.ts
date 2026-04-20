import { serve, type Server } from "bun";
import { sql } from "drizzle-orm";
import { appConfig } from "../src/shared/appConfig";
import { logger } from "../src/shared/logger";
import type { Agent, Check, IncidentEvent } from "../src/shared/types";
import { config } from "./config";
import { getDatabase } from "./db";
import { agents, checks, incidentEvents, stats } from "./schema";

type DaemonServer = Server<undefined>;

const VERSION = appConfig.version;
const startTime = Date.now();

function checkAuth(req: Request): boolean {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return false;
  return auth.slice(7) === config.secret;
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

function rowToCheck(row: {
  id: number;
  agentId: number;
  checkedAt: Date;
  status: string;
  responseMs: number | null;
  httpStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}): Check {
  return {
    id: row.id,
    agentId: row.agentId,
    checkedAt: row.checkedAt.getTime(),
    status: row.status as Check["status"],
    responseMs: row.responseMs,
    httpStatus: row.httpStatus,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
  };
}

function rowToIncidentEvent(row: {
  id: number;
  agentId: number;
  incidentId: string;
  eventAt: Date;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
}): IncidentEvent {
  return {
    id: row.id,
    agentId: row.agentId,
    incidentId: row.incidentId,
    eventAt: row.eventAt.getTime(),
    eventType: row.eventType as IncidentEvent["eventType"],
    fromStatus: row.fromStatus as IncidentEvent["fromStatus"],
    toStatus: row.toStatus as IncidentEvent["toStatus"],
    reason: row.reason,
  };
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
      const { db } = getDatabase();
      const rows = db.select().from(agents).all();
      return jsonResponse(rows);
    }

    // PUT /agents
    if (method === "PUT" && path === "/agents") {
      const body = (await req.json()) as Agent[];
      if (!Array.isArray(body)) {
        return errorResponse("Expected array of agents");
      }

      const { db, sqlite } = getDatabase();
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        sqlite.run("DELETE FROM agents");
        for (const agent of body) {
          db.insert(agents)
            .values({
              id: agent.id,
              type: agent.type,
              name: agent.name,
              url: agent.url,
              port: agent.port,
              enabled: agent.enabled ?? true,
              healthEndpoint: agent.healthEndpoint ?? null,
              statusShape: agent.statusShape ?? null,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .run();
        }
        sqlite.exec("COMMIT");
      } catch (err) {
        sqlite.exec("ROLLBACK");
        throw err;
      }

      return jsonResponse({ updated: body.length });
    }

    // GET /checks?since=<ms>&limit=<n>
    if (method === "GET" && path === "/checks") {
      const { db } = getDatabase();
      const since = parseInt(url.searchParams.get("since") || "0", 10);
      const limit = Math.min(
        parseInt(url.searchParams.get("limit") || "1000", 10),
        5000,
      );

      const rows = db
        .select()
        .from(checks)
        .where(sql`${checks.checkedAt} >= ${since}`)
        .orderBy(checks.checkedAt)
        .limit(limit + 1)
        .all();

      const hasMore = rows.length > limit;
      const page = rows.slice(0, limit);
      const nextCursor = hasMore
        ? page[page.length - 1].checkedAt
        : null;

      return jsonResponse({
        checks: page.map(rowToCheck),
        nextCursor,
      });
    }

    // GET /stats?since=<ms>
    if (method === "GET" && path === "/stats") {
      const { db } = getDatabase();
      const since = parseInt(url.searchParams.get("since") || "0", 10);
      // Convert ms to seconds for hourTimestamp comparison
      const sinceSecs = Math.floor(since / 1000);

      const rows = db
        .select()
        .from(stats)
        .where(sql`${stats.hourTimestamp} >= ${sinceSecs}`)
        .orderBy(stats.hourTimestamp)
        .all();

      return jsonResponse(rows);
    }

    // GET /incident-events?since=<ms>
    if (method === "GET" && path === "/incident-events") {
      const { db } = getDatabase();
      const since = parseInt(url.searchParams.get("since") || "0", 10);

      const rows = db
        .select()
        .from(incidentEvents)
        .where(sql`${incidentEvents.eventAt} >= ${since}`)
        .orderBy(incidentEvents.eventAt)
        .all();

      return jsonResponse(rows.map(rowToIncidentEvent));
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
