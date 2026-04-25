import { describe, it, expect } from "bun:test";
import {
  statusIcons,
  statusTones,
  statusLabels,
  eventBadgeConfig,
} from "../../shared/status-config";
import type { CheckStatus, EventType } from "../../shared/types";

describe("status-config", () => {
  describe("statusIcons", () => {
    it("should have an icon for every CheckStatus", () => {
      const statuses: CheckStatus[] = ["ok", "offline", "error", "degraded"];
      for (const status of statuses) {
        expect(statusIcons[status]).toBeDefined();
        expect(typeof statusIcons[status]).toBe("string");
      }
    });

    it("should have expected icon names", () => {
      expect(statusIcons.ok).toBe("checkCircle");
      expect(statusIcons.offline).toBe("wifiOff");
      expect(statusIcons.error).toBe("alertCircle");
      expect(statusIcons.degraded).toBe("alertTriangle");
    });
  });

  describe("statusTones", () => {
    it("should have a tone for every CheckStatus", () => {
      const statuses: CheckStatus[] = ["ok", "offline", "error", "degraded"];
      for (const status of statuses) {
        expect(statusTones[status]).toBeDefined();
      }
    });

    it("should map ok to success", () => {
      expect(statusTones.ok).toBe("success");
    });

    it("should map offline to neutral", () => {
      expect(statusTones.offline).toBe("neutral");
    });

    it("should map error to warning", () => {
      expect(statusTones.error).toBe("warning");
    });

    it("should map degraded to danger", () => {
      expect(statusTones.degraded).toBe("danger");
    });
  });

  describe("statusLabels", () => {
    it("should have human-readable labels", () => {
      expect(statusLabels.ok).toBe("OK");
      expect(statusLabels.offline).toBe("Offline");
      expect(statusLabels.error).toBe("Error");
      expect(statusLabels.degraded).toBe("Degraded");
    });
  });

  describe("eventBadgeConfig", () => {
    it("should have config for every EventType", () => {
      const types: EventType[] = [
        "opened",
        "status_changed",
        "recovered",
        "handoff",
      ];
      for (const type of types) {
        expect(eventBadgeConfig[type]).toBeDefined();
        expect(eventBadgeConfig[type].label).toBeDefined();
        expect(eventBadgeConfig[type].tone).toBeDefined();
      }
    });

    it("should map opened to danger tone", () => {
      expect(eventBadgeConfig.opened.tone).toBe("danger");
      expect(eventBadgeConfig.opened.label).toBe("Opened");
    });

    it("should map recovered to success tone", () => {
      expect(eventBadgeConfig.recovered.tone).toBe("success");
      expect(eventBadgeConfig.recovered.label).toBe("Recovered");
    });

    it("should map status_changed to warning tone", () => {
      expect(eventBadgeConfig.status_changed.tone).toBe("warning");
    });

    it("should map handoff to warning tone", () => {
      expect(eventBadgeConfig.handoff.tone).toBe("warning");
    });
  });
});
