import { agents } from "./schema";
import { getDatabase } from "./db";
import { AgentStorage } from "../backend";
import type { Agent } from "../../../shared/types";
import { logger } from "../../services/loggerService";

type AgentFieldTuple = [
  type: string,
  name: string,
  url: string,
  port: number,
  enabled: boolean,
  healthEndpoint: string | null,
  statusShape: string | null,
];

function agentToTuple(agent: Agent): AgentFieldTuple {
  return [
    agent.type,
    agent.name,
    agent.url,
    agent.port,
    agent.enabled ?? true,
    agent.healthEndpoint ?? null,
    agent.statusShape ?? null,
  ];
}

const AGENT_COLUMNS = [
  "type",
  "name",
  "url",
  "port",
  "enabled",
  "health_endpoint",
  "status_shape",
] as const;

const AGENT_PLACEHOLDERS = AGENT_COLUMNS.map(() => "?").join(", ");
const UPDATE_SET_CLAUSE = AGENT_COLUMNS.map((c) => `${c} = ?`).join(", ");

const INSERT_SQL = `INSERT INTO agents (${AGENT_COLUMNS.join(", ")}, updated_at) VALUES (${AGENT_PLACEHOLDERS}, ?)`;
const UPDATE_SQL = `UPDATE agents SET ${UPDATE_SET_CLAUSE}, updated_at = ? WHERE id = ?`;

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

export class SqliteAgentStorage implements AgentStorage {
  async readAgents(): Promise<Agent[]> {
    const { db } = getDatabase();
    const rows = db.select().from(agents).all();
    return rows.map(rowToAgent);
  }

  async writeAgents(agentList: Agent[]): Promise<void> {
    const { sqlite } = getDatabase();

    const write = sqlite.transaction(() => {
      const now = new Date(Date.now());
      const updateStmt = sqlite.prepare(UPDATE_SQL);
      const insertStmt = sqlite.prepare(INSERT_SQL);

      for (const agent of agentList) {
        const values: AgentFieldTuple = agentToTuple(agent);
        if (agent.id > 0) {
          updateStmt.run(...values, now.getTime(), agent.id);
        } else {
          insertStmt.run(...values, now.getTime());
        }
      }

      const existingIds = sqlite.query("SELECT id FROM agents").all() as {
        id: number;
      }[];
      const newIds = new Set(
        agentList.filter((a) => a.id > 0).map((a) => a.id),
      );

      for (const row of existingIds) {
        if (!newIds.has(row.id)) {
          sqlite.query("DELETE FROM agents WHERE id = ?").run(row.id);
        }
      }
    });

    write();
    logger.debug("storage", `Wrote ${agentList.length} agents to database`);
  }

  async insertAgent(agent: Omit<Agent, "id">): Promise<Agent> {
    const { sqlite } = getDatabase();
    const stmt = sqlite.prepare(INSERT_SQL);
    const values: AgentFieldTuple = agentToTuple(agent as Agent);
    const result = stmt.run(...values, Date.now());
    logger.debug("storage", `Inserted agent: ${agent.name}`);
    return { ...agent, id: result.lastInsertRowid as number };
  }
}
