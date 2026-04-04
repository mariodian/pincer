import Electrobun, { BrowserWindow, Screen, Utils } from "electrobun/bun";
import { setupMainWindowMenu } from "./applicationMenu";
import { agentRequestHandlers } from "./rpc/agentRPC";
import { performAutoUpdateCheck, updateRequestHandlers } from "./rpc/updateRPC";
import { settingsRequestHandlers } from "./rpc/settingsRPC";
import { statsRequestHandlers } from "./rpc/statsRPC";
import {
  setRendererReadyCallback,
  systemRPC,
  systemRequestHandlers,
} from "./rpc/systemRPC";
import { getMainWindow, setMainWindow } from "./rpc/windowRegistry";
import { initDatabase } from "./services/agentService";
import { initLogger, logger } from "./services/loggerService";
import { beginStatusUpdates } from "./services/statusService";
import { getSettings } from "./storage/sqlite/settingsRepo";
import {
  getWindowBounds,
  setWindowBounds,
  type WindowBounds,
} from "./storage/sqlite/appStateRepo";
import { initializeTray, syncAgentsFromKnownStatuses } from "./trayManager";
import { applyMacOSWindowEffects } from "./utils/macOSWindowEffects";
import { isMacOS } from "./utils/platform";
import { getViewUrl } from "./utils/url";
import { readWindowConfig } from "./utils/windowConfig";

import { APP_NAME, MAIN_WINDOW } from "./config";

/**
 * Check if saved window bounds are within a visible display.
 * Returns valid bounds or null if they need resetting.
 */
function validateWindowBounds(bounds: WindowBounds): WindowBounds | null {
  const displays = Screen.getAllDisplays();
  const margin = 50; // Allow partial off-screen (50px margin)

  for (const display of displays) {
    const workArea = display.bounds;
    // Check if at least part of the window is visible
    if (
      bounds.x + bounds.width > workArea.x - margin &&
      bounds.x < workArea.x + workArea.width + margin &&
      bounds.y + bounds.height > workArea.y - margin &&
      bounds.y < workArea.y + workArea.height + margin
    ) {
      return bounds;
    }
  }
  return null;
}

declare global {
  interface Window {
    platform: string;
  }
}

const platformIsMacOS = isMacOS();

// Combine RPCs: use systemRPC as base, register all request handlers via setRequestHandler
const combinedRPC = systemRPC;
combinedRPC.setRequestHandler({
  ...systemRequestHandlers,
  ...agentRequestHandlers,
  ...settingsRequestHandlers,
  ...statsRequestHandlers,
  ...updateRequestHandlers,
});

/**
 * Create and configure the main application window.
 * Registers the window in the global registry and sets up close handling.
 */
export async function createMainWindow(): Promise<BrowserWindow> {
  const url = await getViewUrl("index.html");
  const wc = await readWindowConfig("main");
  const savedBounds = getWindowBounds();

  // Use saved bounds if available and valid, otherwise center on screen
  let windowX: number;
  let windowY: number;
  let windowWidth: number;
  let windowHeight: number;

  if (savedBounds) {
    const validBounds = validateWindowBounds(savedBounds);
    if (validBounds) {
      windowX = validBounds.x;
      windowY = validBounds.y;
      windowWidth = validBounds.width;
      windowHeight = validBounds.height;
      logger.debug("app", "Restored window bounds from app state");
    } else {
      // Bounds are off-screen, reset to center
      const primaryDisplay = Screen.getPrimaryDisplay();
      windowWidth = MAIN_WINDOW.width;
      windowHeight = MAIN_WINDOW.height;
      windowX = Math.round(
        primaryDisplay.bounds.x +
          (primaryDisplay.bounds.width - windowWidth) / 2,
      );
      windowY = Math.round(
        primaryDisplay.bounds.y +
          (primaryDisplay.bounds.height - windowHeight) / 2,
      );
      logger.debug("app", "Window bounds off-screen, resetting to center");
    }
  } else {
    // No saved bounds, center on primary display
    const primaryDisplay = Screen.getPrimaryDisplay();
    windowWidth = MAIN_WINDOW.width;
    windowHeight = MAIN_WINDOW.height;
    windowX = Math.round(
      primaryDisplay.bounds.x + (primaryDisplay.bounds.width - windowWidth) / 2,
    );
    windowY = Math.round(
      primaryDisplay.bounds.y +
        (primaryDisplay.bounds.height - windowHeight) / 2,
    );
  }

  const mainWindow = new BrowserWindow({
    title: APP_NAME,
    url,
    frame: {
      width: windowWidth,
      height: windowHeight,
      x: windowX,
      y: windowY,
    },
    rpc: combinedRPC as any,
    ...(platformIsMacOS
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

  if (platformIsMacOS) {
    applyMacOSWindowEffects("main", mainWindow, wc);
  }

  setMainWindow(mainWindow);
  setupMainWindowMenu(mainWindow);

  mainWindow.on("close", () => {
    logger.debug("app", "Main window closing");
    // Save window bounds to restore on next open
    try {
      const bounds = mainWindow.getFrame();
      setWindowBounds({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      });
      logger.debug("app", "Window bounds saved on close");
    } catch (error) {
      logger.warn(
        "app",
        "Failed to save window bounds:",
        error instanceof Error ? error.message : String(error),
      );
    }
    Utils.setDockIconVisible(false);
    setMainWindow(null);
  });

  // On non-macOS platforms, enforce minimum window size by listening to resize events
  // MacOS handles this natively via the setWindowMinSize call
  let resizeTimeout: Timer | null = null;
  if (!platformIsMacOS) {
    mainWindow.on("resize", (event: any) => {
      const { x, y, width, height } = event.data;

      if (width < MAIN_WINDOW.minWidth || height < MAIN_WINDOW.minHeight) {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          mainWindow.setFrame(
            x,
            y,
            Math.max(width, MAIN_WINDOW.minWidth),
            Math.max(height, MAIN_WINDOW.minHeight),
          );
          resizeTimeout = null;
        }, 150);
      }
    });
  }

  return mainWindow;
}

// Initialize logger first (reads channel, env vars, sets up file logging)
await initLogger();
logger.info("app", "Logger initialized");

// Initialize database before any other operations
await initDatabase();
logger.info("app", "Database initialized");

// Initialize tray icon
await initializeTray();
logger.info("app", "Tray initialized");

// Perform automatic update check if enabled and due
void performAutoUpdateCheck();

// Hide dock icon immediately — shown later only if main window is created
Utils.setDockIconVisible(false);

setRendererReadyCallback(({ view }) => {
  if (view === "main") {
    void syncAgentsFromKnownStatuses(false);
    void beginStatusUpdates();
  }
});

// Save window bounds before app quits (when window is open but not closed yet)
Electrobun.events.on("before-quit", () => {
  const mainWindow = getMainWindow();
  if (mainWindow) {
    try {
      const bounds = mainWindow.getFrame();
      setWindowBounds({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      });
      logger.debug("app", "Window bounds saved on quit");
    } catch (error) {
      logger.warn(
        "app",
        "Failed to save bounds on quit:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
});

// Start centralized polling regardless of whether the window is open.
// This keeps tray and popover status data up to date.
void beginStatusUpdates();

// Conditionally create the main window on startup
if (getSettings().openMainWindow) {
  Utils.setDockIconVisible(true);
  logger.info("app", "Creating main window...");
  await createMainWindow();
  logger.debug("app", "Main window created");
}

logger.info("app", "Pincer started!");
