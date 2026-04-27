// retentionService.ts - thin production wrapper
import { countOldChecks, deleteOldChecks } from "../storage/sqlite/checksRepo";
import {
  countOldEvents,
  deleteOldEvents,
} from "../storage/sqlite/incidentEventsRepo";
import { getSettings } from "../storage/sqlite/settingsRepo"; // static import now safe
import { logger } from "./loggerService";
import { createRetentionService } from "./retentionCore";

const service = createRetentionService({
  countOldChecks,
  deleteOldChecks,
  countOldEvents,
  deleteOldEvents,
  getRetentionDays: () => getSettings().retentionDays,
  logger,
});

export const {
  runRetentionCleanup,
  runIncidentRetentionCleanup,
  startRetentionService,
  stopRetentionService,
  triggerManualCleanup,
  getRetentionConfig,
} = service;
