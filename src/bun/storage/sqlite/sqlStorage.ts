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
      const stmt = sqlite.prepare(
        `INSERT INTO agents (id, type, name, url, port, enabled, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           type = excluded.type,
           name = excluded.name,
           url = excluded.url,
           port = excluded.port,
           enabled = excluded.enabled,
           updated_at = excluded.updated_at`,
      );

      for (const agent of agentList) {
        stmt.run(
          agent.id,
          agent.type,
          agent.name,
          agent.url,
          agent.port,
          agent.enabled ?? true,
          now.getTime(),
        );
      }

      // Delete agents that are no longer in the list
      const existingIds = sqlite
        .query("SELECT id FROM agents")
        .all() as { id: string }[];
      const newIds = new Set(agentList.map((a) => a.id));

      for (const row of existingIds) {
        if (!newIds.has(row.id)) {
          sqlite.query("DELETE FROM agents WHERE id = ?").run(row.id);
        }
      }
    });

    write();
  }
}
