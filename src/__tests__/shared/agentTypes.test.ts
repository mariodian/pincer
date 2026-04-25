import { describe, it, expect } from "bun:test";
import {
  AGENT_TYPES,
  getAgentType,
  getAgentTypeList,
  STATUS_PARSERS,
  STATUS_SHAPE_OPTIONS,
} from "../../shared/agentTypes";

describe("agentTypes", () => {
  describe("AGENT_TYPES registry", () => {
    it("should contain all expected agent types", () => {
      expect(AGENT_TYPES.custom).toBeDefined();
      expect(AGENT_TYPES.openclaw).toBeDefined();
      expect(AGENT_TYPES.opencrabs).toBeDefined();
      expect(AGENT_TYPES.hermes).toBeDefined();
      expect(AGENT_TYPES.opencode).toBeDefined();
    });

    it("should have correct defaults for custom agent", () => {
      const custom = AGENT_TYPES.custom;
      expect(custom.id).toBe("custom");
      expect(custom.name).toBe("Custom");
      expect(custom.healthEndpoint).toBe("/health");
      expect(custom.healthMethod).toBe("GET");
      expect(custom.defaultPort).toBe(18790);
    });

    it("should have correct defaults for openclaw agent", () => {
      const openclaw = AGENT_TYPES.openclaw;
      expect(openclaw.id).toBe("openclaw");
      expect(openclaw.name).toBe("OpenClaw");
      expect(openclaw.defaultPort).toBe(18789);
    });

    it("should have correct defaults for opencode agent", () => {
      const opencode = AGENT_TYPES.opencode;
      expect(opencode.id).toBe("opencode");
      expect(opencode.name).toBe("OpenCode");
      expect(opencode.healthEndpoint).toBe("/global/health");
      expect(opencode.defaultPort).toBe(4096);
    });

    it("should have correct defaults for opencrabs agent", () => {
      const opencrabs = AGENT_TYPES.opencrabs;
      expect(opencrabs.healthEndpoint).toBe("/a2a/health");
      expect(opencrabs.defaultPort).toBe(18790);
    });
  });

  describe("getAgentType", () => {
    it("should return agent type by id", () => {
      expect(getAgentType("custom")?.id).toBe("custom");
      expect(getAgentType("openclaw")?.id).toBe("openclaw");
    });

    it("should return undefined for unknown type", () => {
      expect(getAgentType("unknown")).toBeUndefined();
    });
  });

  describe("getAgentTypeList", () => {
    it("should return list of agent type summaries", () => {
      const list = getAgentTypeList();
      expect(list.length).toBe(Object.keys(AGENT_TYPES).length);
      expect(list[0]).toHaveProperty("id");
      expect(list[0]).toHaveProperty("name");
      expect(list[0]).toHaveProperty("defaultPort");
    });

    it("should not include parseStatus in list", () => {
      const list = getAgentTypeList();
      expect(list[0]).not.toHaveProperty("parseStatus");
    });
  });

  describe("STATUS_PARSERS", () => {
    describe("always_ok", () => {
      it("should return ok for any input", () => {
        expect(STATUS_PARSERS.always_ok({})).toEqual({ status: "ok" });
        expect(STATUS_PARSERS.always_ok(null)).toEqual({ status: "ok" });
        expect(STATUS_PARSERS.always_ok({ status: "error" })).toEqual({
          status: "ok",
        });
      });
    });

    describe("json_status", () => {
      it("should return ok when JSON status is ok", () => {
        expect(STATUS_PARSERS.json_status({ status: "ok" })).toEqual({
          status: "ok",
        });
      });

      it("should return error when JSON status is not ok", () => {
        expect(STATUS_PARSERS.json_status({ status: "error" })).toEqual({
          status: "error",
        });
        expect(STATUS_PARSERS.json_status({ status: "degraded" })).toEqual({
          status: "error",
        });
      });

      it("should return error for null input", () => {
        expect(STATUS_PARSERS.json_status(null)).toEqual({
          status: "error",
          errorMessage: "Invalid JSON status format",
        });
      });

      it("should return error for missing status field", () => {
        expect(STATUS_PARSERS.json_status({})).toEqual({ status: "error" });
      });
    });
  });

  describe("STATUS_SHAPE_OPTIONS", () => {
    it("should have exactly the expected options", () => {
      expect(STATUS_SHAPE_OPTIONS.length).toBe(2);
      expect(STATUS_SHAPE_OPTIONS[0].value).toBe("always_ok");
      expect(STATUS_SHAPE_OPTIONS[1].value).toBe("json_status");
    });
  });
});
