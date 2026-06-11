import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
  deleteAgent,
  insertAgent,
  readAgents,
  updateAgent,
  writeAgents,
} from "../../../../bun/storage/sqlite/agentsRepo";
import { createAgent } from "../../../setup";
import { resetTestDB, setupTestDB } from "./test-helpers";

describe("agentsRepo", () => {
  const baseAgent = { type: "custom", name: "A", url: "http://a", port: 80 };

  beforeEach(() => setupTestDB());
  afterEach(() => resetTestDB());

  // ─── readAgents ────────────────────────────────────────────────────────────

  describe("readAgents", () => {
    it("should return empty array when no agents", () => {
      expect(readAgents()).toEqual([]);
    });

    it("should return all inserted agents", () => {
      insertAgent({ ...baseAgent, name: "Agent A", url: "http://a" });
      insertAgent({
        ...baseAgent,
        name: "Agent B",
        url: "http://b",
        port: 443,
      });
      const agents = readAgents();
      expect(agents.length).toBe(2);
      expect(agents.map((a) => a.name)).toContain("Agent A");
      expect(agents.map((a) => a.name)).toContain("Agent B");
    });

    it("should preserve optional fields", () => {
      insertAgent({
        ...baseAgent,
        name: "Agent A",
        url: "http://a",
        enabled: false,
        healthEndpoint: "/health",
        statusShape: "v1",
      });
      const agents = readAgents();
      expect(agents[0].enabled).toBe(false);
      expect(agents[0].healthEndpoint).toBe("/health");
      expect(agents[0].statusShape).toBe("v1");
    });
  });

  // ─── insertAgent ───────────────────────────────────────────────────────────

  describe("insertAgent", () => {
    it("should assign an auto-increment id", () => {
      const a1 = insertAgent({ ...baseAgent, name: "A1", url: "http://a1" });
      const a2 = insertAgent({ ...baseAgent, name: "A2", url: "http://a2" });
      expect(a1.id).toBeGreaterThan(0);
      expect(a2.id).toBe(a1.id + 1);
    });

    it("should default enabled to true", () => {
      const a = insertAgent(baseAgent);
      expect(a.enabled).toBe(true);
    });
  });

  // ─── updateAgent ───────────────────────────────────────────────────────────

  describe("updateAgent", () => {
    it("should update only specified fields", () => {
      const a = insertAgent(baseAgent);
      updateAgent(a.id, { name: "Renamed", port: 8080 });

      const updated = readAgents().find((ag) => ag.id === a.id)!;
      expect(updated.name).toBe("Renamed");
      expect(updated.port).toBe(8080);
      expect(updated.url).toBe("http://a");
      expect(updated.type).toBe("custom");
    });

    it("should update optional fields", () => {
      const a = insertAgent(baseAgent);
      updateAgent(a.id, {
        healthEndpoint: "/healthz",
        statusShape: "v2",
        enabled: false,
      });

      const updated = readAgents().find((ag) => ag.id === a.id)!;
      expect(updated.healthEndpoint).toBe("/healthz");
      expect(updated.statusShape).toBe("v2");
      expect(updated.enabled).toBe(false);
    });

    it("should be no-op for non-existent id", () => {
      updateAgent(9999, { name: "Ghost" });
      expect(readAgents()).toEqual([]);
    });
  });

  // ─── deleteAgent ───────────────────────────────────────────────────────────

  describe("deleteAgent", () => {
    it("should delete agent and cascade related checks", () => {
      const { sqlite } = setupTestDB();
      const a = insertAgent(baseAgent);

      sqlite.run(
        `INSERT INTO checks (agent_id, checked_at, status) VALUES (${a.id}, 1000, 'ok')`,
      );
      sqlite.run(
        `INSERT INTO stats (agent_id, hour_timestamp, total_checks, ok_count, offline_count, error_count, uptime_pct, avg_response_ms) VALUES (${a.id}, 1000, 1, 1, 0, 0, 100, 10)`,
      );
      sqlite.run(
        `INSERT INTO incident_events (agent_id, incident_id, event_at, event_type) VALUES (${a.id}, 'inc-1', 1000, 'opened')`,
      );

      deleteAgent(a.id);

      expect(readAgents()).toEqual([]);
      const checks = sqlite
        .prepare("SELECT * FROM checks WHERE agent_id = ?")
        .all(a.id) as unknown[];
      expect(checks.length).toBe(0);
      const statsRows = sqlite
        .prepare("SELECT * FROM stats WHERE agent_id = ?")
        .all(a.id) as unknown[];
      expect(statsRows.length).toBe(0);
      const events = sqlite
        .prepare("SELECT * FROM incident_events WHERE agent_id = ?")
        .all(a.id) as unknown[];
      expect(events.length).toBe(0);
    });

    it("should not affect other agents data", () => {
      const { sqlite } = setupTestDB();
      const a1 = insertAgent({ ...baseAgent, name: "A1", url: "http://a1" });
      const a2 = insertAgent({ ...baseAgent, name: "A2", url: "http://a2" });

      sqlite.run(
        `INSERT INTO checks (agent_id, checked_at, status) VALUES (${a1.id}, 1000, 'ok')`,
      );
      sqlite.run(
        `INSERT INTO checks (agent_id, checked_at, status) VALUES (${a2.id}, 2000, 'ok')`,
      );

      deleteAgent(a1.id);

      const remainingChecks = sqlite
        .prepare("SELECT * FROM checks")
        .all() as unknown[];
      expect(remainingChecks.length).toBe(1);
      expect(readAgents().length).toBe(1);
      expect(readAgents()[0].id).toBe(a2.id);
    });

    it("should not throw when deleting non-existent agent", () => {
      deleteAgent(9999);
      expect(readAgents()).toEqual([]);
    });
  });

  // ─── writeAgents ───────────────────────────────────────────────────────────

  describe("writeAgents", () => {
    it("should insert new agents with id > 0 when they do not exist", () => {
      writeAgents([
        createAgent({ id: 10, name: "A10", url: "http://a10", port: 80 }),
      ]);
      const agents = readAgents();
      expect(agents.length).toBe(1);
      expect(agents[0].id).toBe(10);
    });

    it("should upsert existing agents by id", () => {
      const a = insertAgent(baseAgent);
      writeAgents([
        createAgent({
          id: a.id,
          name: "Updated",
          url: "http://new",
          port: 8080,
        }),
      ]);

      const agents = readAgents();
      expect(agents.length).toBe(1);
      expect(agents[0].name).toBe("Updated");
      expect(agents[0].port).toBe(8080);
    });

    it("should auto-assign id for agents with id <= 0", () => {
      writeAgents([
        createAgent({ id: 0, name: "New1", url: "http://n1", port: 80 }),
      ]);
      const agents = readAgents();
      expect(agents.length).toBe(1);
      expect(agents[0].id).toBeGreaterThan(0);
    });

    it("should remove local agents not in incoming list", () => {
      const a1 = insertAgent({ ...baseAgent, name: "Keep", url: "http://k" });
      insertAgent({ ...baseAgent, name: "Remove", url: "http://r" });

      writeAgents([
        createAgent({ id: a1.id, name: "Keep", url: "http://k", port: 80 }),
      ]);

      const agents = readAgents();
      expect(agents.length).toBe(1);
      expect(agents[0].id).toBe(a1.id);
    });

    it("should cascade delete when removing agents via writeAgents", () => {
      const { sqlite } = setupTestDB();
      const a1 = insertAgent({ ...baseAgent, name: "Keep", url: "http://k" });
      const a2 = insertAgent({ ...baseAgent, name: "Remove", url: "http://r" });

      sqlite.run(
        `INSERT INTO checks (agent_id, checked_at, status) VALUES (${a2.id}, 1000, 'ok')`,
      );

      writeAgents([
        createAgent({ id: a1.id, name: "Keep", url: "http://k", port: 80 }),
      ]);

      const checks = sqlite.prepare("SELECT * FROM checks").all() as unknown[];
      expect(checks.length).toBe(0);
    });

    it("should handle mixed batch of inserts and updates", () => {
      const existing = insertAgent({ ...baseAgent, name: "Old" });
      writeAgents([
        createAgent({ id: existing.id, name: "Updated" }),
        createAgent({ id: 99, name: "New99", url: "http://n", port: 80 }),
        createAgent({ id: 0, name: "Auto", url: "http://a", port: 80 }),
      ]);

      const agents = readAgents();
      expect(agents.length).toBe(3);
      expect(agents.map((a) => a.name)).toContain("Updated");
      expect(agents.map((a) => a.name)).toContain("New99");
      expect(agents.map((a) => a.name)).toContain("Auto");
    });
  });
});
