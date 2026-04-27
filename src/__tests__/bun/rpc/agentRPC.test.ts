import { describe, expect, it } from "bun:test";

import {
  shouldMarkOffline,
  shouldRunHealthCheck,
} from "../../../bun/rpc/agentRPCHelpers";

/**
 * agentRPC Helper Function Unit Tests
 *
 * These tests verify the logic of the shouldMarkOffline and shouldRunHealthCheck
 * functions, which determine whether an agent's status should be updated to
 * offline or if a health check should be triggered based on the fields that
 * were updated. This logic is critical for ensuring that the UI reflects the
 * correct status of agents after updates.
 */
describe("agentRPC helpers", () => {
  describe("shouldMarkOffline", () => {
    it("returns true when enabled is explicitly false", () => {
      expect(shouldMarkOffline({ enabled: false })).toBe(true);
    });

    it("returns false when enabled is true", () => {
      expect(shouldMarkOffline({ enabled: true })).toBe(false);
    });

    it("returns false when enabled is not provided", () => {
      expect(shouldMarkOffline({})).toBe(false);
    });

    it("returns false for unrelated updates", () => {
      expect(
        shouldMarkOffline({
          name: "Renamed Agent",
          url: "http://localhost",
          port: 8080,
        }),
      ).toBe(false);
    });
  });

  describe("shouldRunHealthCheck", () => {
    it("returns true when enabled is explicitly true", () => {
      expect(shouldRunHealthCheck({ enabled: true })).toBe(true);
    });

    it("returns false when enabled is explicitly false", () => {
      expect(shouldRunHealthCheck({ enabled: false })).toBe(false);
    });

    it("returns true when url changes", () => {
      expect(
        shouldRunHealthCheck({
          url: "http://new-host",
        }),
      ).toBe(true);
    });

    it("returns true when port changes", () => {
      expect(
        shouldRunHealthCheck({
          port: 9999,
        }),
      ).toBe(true);
    });

    it("returns true when healthEndpoint changes", () => {
      expect(
        shouldRunHealthCheck({
          healthEndpoint: "/readyz",
        }),
      ).toBe(true);
    });

    it("returns true when statusShape changes", () => {
      expect(
        shouldRunHealthCheck({
          statusShape: "json_status",
        }),
      ).toBe(true);
    });

    it("returns false for non-health-check updates", () => {
      expect(
        shouldRunHealthCheck({
          name: "Just a rename",
        }),
      ).toBe(false);
    });

    it("returns false for empty updates", () => {
      expect(shouldRunHealthCheck({})).toBe(false);
    });
  });
});
