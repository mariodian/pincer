import type { Agent } from "../../../shared/types";
import { eq } from "drizzle-orm";
import { getDatabase } from "./db";
import { agents, checks, incidentEvents, stats } from "./schema";

function rowToAgent(row: typeof agents.$inferSelect): Agent {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    url: row.url,
    port: row.port,
    enabled: row.enabled ?? true,
    healthEndpoint: row.healthEndpoint ?? undefined,
    statusShape: row.statusShape ?? undefined,
  };
}

export function readAgents(): Agent[] {
  const { db } = getDatabase();
  const rows = db.select().from(agents).all();
  return rows.map(rowToAgent);
}

export function insertAgent(agent: Omit<Agent, "id">): Agent {
  const { db } = getDatabase();
  const now = new Date();

  const row = db
    .insert(agents)
    .values({
      type: agent.type,
      name: agent.name,
      url: agent.url,
      port: agent.port,
      enabled: agent.enabled ?? true,
      healthEndpoint: agent.healthEndpoint ?? null,
      statusShape: agent.statusShape ?? null,
      updatedAt: now,
    })
    .returning()
    .get();

  return rowToAgent(row);
}

export function updateAgent(id: number, updates: Partial<Agent>): void {
  const { db } = getDatabase();
  const now = new Date();

  const setValues: Record<string, unknown> = { updatedAt: now };
  if (updates.type !== undefined) setValues.type = updates.type;
  if (updates.name !== undefined) setValues.name = updates.name;
  if (updates.url !== undefined) setValues.url = updates.url;
  if (updates.port !== undefined) setValues.port = updates.port;
  if (updates.enabled !== undefined) setValues.enabled = updates.enabled;
  if (updates.healthEndpoint !== undefined)
    setValues.healthEndpoint = updates.healthEndpoint;
  if (updates.statusShape !== undefined)
    setValues.statusShape = updates.statusShape;

  db.update(agents).set(setValues).where(eq(agents.id, id)).run();
}

export function deleteAgent(id: number): void {
  const { db } = getDatabase();
  db.transaction((tx) => {
    tx.delete(checks).where(eq(checks.agentId, id)).run();
    tx.delete(stats).where(eq(stats.agentId, id)).run();
    tx.delete(incidentEvents).where(eq(incidentEvents.agentId, id)).run();
    tx.delete(agents).where(eq(agents.id, id)).run();
  });
}

export function writeAgents(agentList: Agent[]): void {
  const { db } = getDatabase();
  const now = new Date();

  db.transaction((tx) => {
    const newIds = new Set<number>();

    for (const agent of agentList) {
      if (agent.id > 0) {
        tx.update(agents)
          .set({
            type: agent.type,
            name: agent.name,
            url: agent.url,
            port: agent.port,
            enabled: agent.enabled ?? true,
            healthEndpoint: agent.healthEndpoint ?? null,
            statusShape: agent.statusShape ?? null,
            updatedAt: now,
          })
          .where(eq(agents.id, agent.id))
          .run();

        newIds.add(agent.id);
      } else {
        tx.insert(agents)
          .values({
            type: agent.type,
            name: agent.name,
            url: agent.url,
            port: agent.port,
            enabled: agent.enabled ?? true,
            healthEndpoint: agent.healthEndpoint ?? null,
            statusShape: agent.statusShape ?? null,
            updatedAt: now,
          })
          .run();
      }
    }

    const existingAgents = tx.select().from(agents).all();
    for (const existing of existingAgents) {
      if (!newIds.has(existing.id)) {
        tx.delete(checks).where(eq(checks.agentId, existing.id)).run();
        tx.delete(stats).where(eq(stats.agentId, existing.id)).run();
        tx.delete(incidentEvents)
          .where(eq(incidentEvents.agentId, existing.id))
          .run();
        tx.delete(agents).where(eq(agents.id, existing.id)).run();
      }
    }
  });
}
