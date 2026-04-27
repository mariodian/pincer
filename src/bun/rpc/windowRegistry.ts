// Window registry - stores references to BrowserWindows for cross-module access
import type { BrowserWindow } from "electrobun/bun";

import { logger } from "../services/loggerService";

let mainWindowRef: BrowserWindow | null = null;

export function setMainWindow(win: BrowserWindow | null): void {
  if (win === null) {
    logger.debug("window", "Main window cleared from registry");
  } else {
    logger.debug("window", "Main window registered");
  }
  mainWindowRef = win;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindowRef;
}
