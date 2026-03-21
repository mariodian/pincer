import { agents } from "./schema";
import { getDatabase } from "./db";
import { AgentStorage } from "../backend";
import { Agent } from "../../agentService";

/**
 * Convert a DB row to the Agent interface.
 */
function rowToAgent(row: typeof agents.$inferSelect): Agent {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    url: row.url,
    port: row.port,
    enabled: row.enabled ?? true,
  };
}

export class SqliteAgentStorage implements AgentStorage {
  async readAgents(): Promise<Agent[]> {
    const { db } = getDatabase();

    const rows = db.select().from(agents).all();
    return rows.map(rowToAgent);
  }

  async writeAgents(agentList: Agent[]): Promise<void> {
    const { sqlite } = getDatabase();

    // Use a raw SQLite transaction for atomicity
    const write = sqlite.transaction(() => {
      const now = new Date(Date.now());

      const updateStmt = sqlite.prepare(
        `UPDATE agents SET type = ?, name = ?, url = ?, port = ?, enabled = ?, updated_at = ?
         WHERE id = ?`,
      );

      const insertStmt = sqlite.prepare(
        `INSERT INTO agents (type, name, url, port, enabled, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );

      for (const agent of agentList) {
        if (agent.id > 0) {
          // Existing agent — update
          updateStmt.run(
            agent.type,
            agent.name,
            agent.url,
            agent.port,
            agent.enabled ?? true,
            now.getTime(),
            agent.id,
          );
        } else {
          // New agent — let DB auto-increment the ID
          insertStmt.run(
            agent.type,
            agent.name,
            agent.url,
            agent.port,
            agent.enabled ?? true,
            now.getTime(),
          );
        }
      }

      // Delete agents that are no longer in the list
      const existingIds = sqlite
        .query("SELECT id FROM agents")
        .all() as { id: number }[];
      const newIds = new Set(agentList.filter((a) => a.id > 0).map((a) => a.id));

      for (const row of existingIds) {
        if (!newIds.has(row.id)) {
          sqlite.query("DELETE FROM agents WHERE id = ?").run(row.id);
        }
      }
    });

    write();
  }

  async insertAgent(agent: Omit<Agent, "id">): Promise<Agent> {
    const { sqlite } = getDatabase();

    const stmt = sqlite.prepare(
      `INSERT INTO agents (type, name, url, port, enabled, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    const result = stmt.run(
      agent.type,
      agent.name,
      agent.url,
      agent.port,
      agent.enabled ?? true,
      Date.now(),
    );

    return {
      ...agent,
      id: result.lastInsertRowid as number,
    };
  }
}
