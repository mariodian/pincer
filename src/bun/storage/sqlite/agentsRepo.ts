import type { Agent } from "../../../shared/types";
import { eq } from "drizzle-orm";
import { getDatabase } from "./db";
import { agents } from "./schema";

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
  db.delete(agents).where(eq(agents.id, id)).run();
}

export function writeAgents(agentList: Agent[]): void {
  const { db } = getDatabase();
  const now = new Date();

  db.transaction((tx) => {
    const newIds = new Set<number>();

    for (const agent of agentList) {
      if (agent.id > 0) {
        const exists = tx
          .select()
          .from(agents)
          .where(eq(agents.id, agent.id))
          .get();

        if (exists) {
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
        } else {
          tx.insert(agents)
            .values({
              id: agent.id,
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

        newIds.add(agent.id);
      } else {
        const result = tx.insert(agents)
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
        newIds.add(result.id);
      }
    }

    const existingAgents = tx.select().from(agents).all();
    for (const existing of existingAgents) {
      if (!newIds.has(existing.id)) {
        tx.delete(agents).where(eq(agents.id, existing.id)).run();
      }
    }
  });
}
