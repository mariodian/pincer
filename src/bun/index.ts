import { BrowserWindow, Screen, Utils } from "electrobun/bun";
import { setupMainWindowMenu } from "./applicationMenu";
import { agentRequestHandlers } from "./rpc/agentRPC";
import {
  setRendererReadyCallback,
  systemRPC,
  systemRequestHandlers,
} from "./rpc/systemRPC";
import { setMainWindow } from "./rpc/windowRegistry";
import { initDatabase } from "./services/agentService";
import { beginStatusUpdates } from "./services/statusService";
import { initializeTray, syncAgentsFromKnownStatuses } from "./trayManager";
import { applyMacOSWindowEffects } from "./utils/macOSWindowEffects";
import { isMacOS as isMacOSFn } from "./utils/platform";
import { getOpenMainWindow } from "./storage/sqlite/configRepo";
import { getViewUrl } from "./utils/url";
import { readWindowConfig } from "./utils/windowConfig";

import { APP_NAME, MAIN_WINDOW } from "./config";

declare global {
  interface Window {
    platform: string;
  }
}

const isMacOS = isMacOSFn();

// Combine RPCs: use systemRPC as base, register all request handlers via setRequestHandler
const combinedRPC = systemRPC;
combinedRPC.setRequestHandler({
  ...systemRequestHandlers,
  ...agentRequestHandlers,
});

/**
 * Create and configure the main application window.
 * Registers the window in the global registry and sets up close handling.
 */
export async function createMainWindow(): Promise<BrowserWindow> {
  const url = await getViewUrl("index.html");
  const wc = await readWindowConfig("main");

  const windowWidth = MAIN_WINDOW.width;
  const windowHeight = MAIN_WINDOW.height;
  const primaryDisplay = Screen.getPrimaryDisplay();
  const displayCenter = {
    x: Math.round(
      primaryDisplay.bounds.x + (primaryDisplay.bounds.width - windowWidth) / 2,
    ),
    y: Math.round(
      primaryDisplay.bounds.y +
        (primaryDisplay.bounds.height - windowHeight) /
          2,
    ),
  };

  const mainWindow = new BrowserWindow({
    title: APP_NAME,
    url,
    frame: {
      width: windowWidth,
      height: windowHeight,
      x: displayCenter.x,
      y: displayCenter.y,
    },
    rpc: combinedRPC as any,
    ...(isMacOS
      ? {
          titleBarStyle: wc.titleBarStyle,
          transparent: wc.transparent,
          styleMask: {
            Borderless: true,
            Titled: true,
            Closable: true,
            Miniaturizable: true,
            Resizable: true,
          },
        }
      : {}),
  });

  if (isMacOS) {
    applyMacOSWindowEffects("main", mainWindow, wc);
  }

  setMainWindow(mainWindow);
  setupMainWindowMenu(mainWindow);

  mainWindow.on("close", () => {
    Utils.setDockIconVisible(false);
    setMainWindow(null);
  });

  return mainWindow;
}

// Initialize database before any other operations
await initDatabase();

// Initialize tray icon
await initializeTray();

setRendererReadyCallback(({ view }) => {
  if (view === "main") {
    void syncAgentsFromKnownStatuses(false);
    void beginStatusUpdates();
  }
});

// Start centralized polling regardless of whether the window is open.
// This keeps tray and popover status data up to date.
void beginStatusUpdates();

// Conditionally create the main window on startup
if (getOpenMainWindow()) {
  await createMainWindow();
}

console.log("CrabControl started!");
