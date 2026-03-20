// Window registry - stores references to BrowserWindows for cross-module access
import type { BrowserWindow } from "electrobun/bun";

let mainWindowRef: BrowserWindow | null = null;

export function setMainWindow(win: BrowserWindow): void {
  mainWindowRef = win;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindowRef;
}
