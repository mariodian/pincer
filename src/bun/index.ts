import { BrowserWindow, Screen, Utils } from "electrobun/bun";
import { setupMainWindowMenu } from "./applicationMenu";
import { agentRequestHandlers } from "./rpc/agentRPC";
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
import { initializeTray, syncAgentsFromKnownStatuses } from "./trayManager";
import { applyMacOSWindowEffects } from "./utils/macOSWindowEffects";
import { isMacOS } from "./utils/platform";
import { clearPendingRoute, getPendingRoute } from "./utils/navigation";
import { getViewUrl } from "./utils/url";
import { readWindowConfig } from "./utils/windowConfig";

import { APP_NAME, MAIN_WINDOW } from "./config";

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
        (primaryDisplay.bounds.height - windowHeight) / 2,
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

// Initialize database before any other operations
await initDatabase();

// Initialize tray icon
await initializeTray();

// Hide dock icon immediately — shown later only if main window is created
Utils.setDockIconVisible(false);

setRendererReadyCallback(({ view }) => {
  if (view === "main") {
    // If a route was requested while the window was being created,
    // navigate now that the renderer RPC is ready.
    const route = getPendingRoute();
    if (route) {
      clearPendingRoute();
      try {
        const rpc = getMainWindow()?.webview.rpc as {
          send?: { navigateTo?: (data: { path: string }) => void };
        } | null;
        rpc?.send?.navigateTo?.({ path: `/${route}` });
      } catch {
        // Window may be closing — fail silently
      }
    }

    void syncAgentsFromKnownStatuses(false);
    void beginStatusUpdates();
  }
});

// Start centralized polling regardless of whether the window is open.
// This keeps tray and popover status data up to date.
void beginStatusUpdates();

// Conditionally create the main window on startup
if (getSettings().openMainWindow) {
  Utils.setDockIconVisible(true);
  await createMainWindow();
}

logger.info("app", "CrabControl started!");
