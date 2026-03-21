import { BrowserWindow, Screen, Utils } from "electrobun/bun";
import { initDatabase } from "./services/agentService";
import { setupMainWindowMenu } from "./applicationMenu";
import { agentRequestHandlers } from "./rpc/agentRPC";
import {
  setRendererReadyCallback,
  systemRPC,
  systemRequestHandlers,
} from "./rpc/systemRPC";
import { setMainWindow } from "./rpc/windowRegistry";
import {
  beginStatusUpdates,
  restartStatusUpdates,
} from "./services/statusService";
import {
  cleanupTray,
  initializeTray,
  syncAgentsFromKnownStatuses,
} from "./trayManager";
import { isMacOS as isMacOSFn } from "./utils/platform";
import { getViewUrl } from "./utils/url";
import { readWindowConfig } from "./utils/windowConfig";
import { applyMacOSWindowEffects } from "./utils/macOSWindowEffects";

import { APP_NAME, MAIN_WINDOW } from "./config";

declare global {
  interface Window {
    platform: string;
  }
}

// Initialize database before any other operations
await initDatabase();

// Create the main application window
const url = await getViewUrl("index.html");
const wc = await readWindowConfig("main");
const isMacOS = isMacOSFn();

const windowWidth = MAIN_WINDOW.width;
const windowHeight = MAIN_WINDOW.height;
const primaryDisplay = Screen.getPrimaryDisplay();
const displayCenter = {
  x: Math.round(
    primaryDisplay.bounds.x + (primaryDisplay.bounds.width - windowWidth) / 2,
  ),
  y: Math.round(
    primaryDisplay.bounds.y + (primaryDisplay.bounds.height - windowHeight) / 2,
  ),
};

// Initialize tray icon
await initializeTray();

setRendererReadyCallback(({ view }) => {
  if (view === "main") {
    void syncAgentsFromKnownStatuses(false);
    void beginStatusUpdates();
  }
});

// Combine RPCs: use systemRPC as base, register all request handlers via setRequestHandler
const combinedRPC = systemRPC;
combinedRPC.setRequestHandler({
  ...systemRequestHandlers,
  ...agentRequestHandlers,
});

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

// Apply macOS-specific window effects
if (isMacOS) {
  applyMacOSWindowEffects("main", mainWindow, wc);
}

setMainWindow(mainWindow);

// Start centralized polling as soon as the app window exists.
void beginStatusUpdates();

setupMainWindowMenu(mainWindow);

// Quit the app when the main window is closed
mainWindow.on("close", () => {
  cleanupTray();
  Utils.quit();
});

console.log("React Tailwind Vite app started!");
