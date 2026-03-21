import { Utils } from "electrobun/bun";
import { readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Agent } from "../../shared/types";
import { ensureAppDataDir } from "../utils/fs";
import { AgentStorage } from "./backend";

function getAgentsFilePath(): string {
  return join(Utils.paths.userData, "agents.json");
}

export class JsonAgentStorage implements AgentStorage {
  async readAgents(): Promise<Agent[]> {
    try {
      await ensureAppDataDir();
      const filePath = getAgentsFilePath();

      try {
        await stat(filePath);
      } catch {
        return [];
      }

      const data = await readFile(filePath, "utf8");
      const parsed = JSON.parse(data);

      let agentsData = parsed;
      if (!Array.isArray(parsed) && parsed.agents) {
        agentsData = parsed.agents;
      }

      if (!Array.isArray(agentsData)) {
        return [];
      }

      const validAgents: Agent[] = [];
      for (const agent of agentsData) {
        if (
          agent.id &&
          agent.name &&
          agent.url &&
          typeof agent.port === "number"
        ) {
          validAgents.push(agent);
        }
      }

      return validAgents;
    } catch (error) {
      console.error("Error reading agents:", error);
      return [];
    }
  }

  async writeAgents(agents: Agent[]): Promise<void> {
    try {
      await ensureAppDataDir();
      const filePath = getAgentsFilePath();

      let existingConfig: Record<string, unknown> = {};
      try {
        const data = await readFile(filePath, "utf8");
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed)) {
          existingConfig = parsed;
        }
      } catch {
        // File doesn't exist yet, use defaults
      }

      const pollingInterval =
        (existingConfig.pollingInterval as number | undefined) ?? 30000;
      const windows = existingConfig.windows as Record<string, unknown> | undefined;

      const content = JSON.stringify(
        {
          agents,
          pollingInterval,
          windows,
        },
        null,
        2,
      );

      await writeFile(filePath, content, "utf8");
    } catch (error) {
      console.error("Error writing agents:", error);
      throw error;
    }
  }

  async insertAgent(agent: Omit<Agent, "id">): Promise<Agent> {
    const agents = await this.readAgents();
    const maxId = agents.reduce((max, a) => Math.max(max, a.id), 0);
    const newAgent: Agent = { ...agent, id: maxId + 1 };
    agents.push(newAgent);
    await this.writeAgents(agents);
    return newAgent;
  }
}
