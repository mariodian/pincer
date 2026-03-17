import { dlopen, FFIType } from "bun:ffi";
import { ApplicationMenu, BrowserWindow, Updater, Utils } from "electrobun/bun";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { agentRPC } from "./agentRPC";
import { cleanupTray, initializeTray } from "./trayManager";
import { readWindowConfig, WindowConfig } from "./windowServce";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// Check if Vite dev server is running for HMR
export async function getMainViewUrl(pagePath = "index.html"): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return `${DEV_SERVER_URL}/${pagePath}`;
    } catch {
      console.log(
        "Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
      );
    }
  }
  return `views://mainview/${pagePath}`;
}

// Create the main application window
const url = await getMainViewUrl("index.html");
const wc = await readWindowConfig("main");
const isMacOS = process.platform === "darwin";

// Initialize tray icon
initializeTray();

export function applyMacOSWindowEffects(
  mainWindow: BrowserWindow,
  windowConfig: WindowConfig,
) {
  const dylibPath = join(import.meta.dir, "libMacWindowEffects.dylib");

  if (!existsSync(dylibPath)) {
    console.warn(
      `Native macOS effects lib not found at ${dylibPath}. Falling back to transparent-only mode.`,
    );
    return;
  }

  try {
    const lib = dlopen(dylibPath, {
      enableWindowVibrancy: {
        args: [FFIType.ptr],
        returns: FFIType.bool,
      },
      ensureWindowShadow: {
        args: [FFIType.ptr],
        returns: FFIType.bool,
      },
      setWindowTrafficLightsPosition: {
        args: [FFIType.ptr, FFIType.f64, FFIType.f64],
        returns: FFIType.bool,
      },
      setTrafficLightsVisible: {
        args: [FFIType.ptr, FFIType.bool],
        returns: FFIType.bool,
      },
      setNativeWindowDragRegion: {
        args: [FFIType.ptr, FFIType.f64, FFIType.f64],
        returns: FFIType.bool,
      },
    });

    const vibrancyEnabled = windowConfig.vibrancy
      ? lib.symbols.enableWindowVibrancy(mainWindow.ptr)
      : false;
    const shadowEnabled = lib.symbols.ensureWindowShadow(mainWindow.ptr);
    lib.symbols.setTrafficLightsVisible(
      mainWindow.ptr,
      windowConfig.trafficLights,
    );
    const alignButtons = () =>
      windowConfig.trafficLights
        ? lib.symbols.setWindowTrafficLightsPosition(
            mainWindow.ptr,
            windowConfig.trafficLightsX,
            windowConfig.trafficLightsY,
          )
        : false;
    const alignNativeDragRegion = () =>
      windowConfig.nativeDragRegion
        ? lib.symbols.setNativeWindowDragRegion(
            mainWindow.ptr,
            windowConfig.nativeDragRegionX,
            windowConfig.nativeDragRegionHeight,
          )
        : false;

    const alignMacOSControls = () => {
      alignButtons();
      alignNativeDragRegion();
    };

    const scheduleAlignMacOSControls = (() => {
      let alignTimeout: ReturnType<typeof setTimeout> | null = null;

      return (delayMs: number) => {
        if (alignTimeout !== null) {
          clearTimeout(alignTimeout);
        }

        alignTimeout = setTimeout(() => {
          alignTimeout = null;
          alignMacOSControls();
        }, delayMs);
      };
    })();

    mainWindow.on("resize", () => {
      // Keep controls pinned during live resize.
      alignMacOSControls();

      // Re-apply once Cocoa finishes the current resize pass.
      scheduleAlignMacOSControls(70);
    });

    // Initial alignment once the window is fully created and laid out.
    scheduleAlignMacOSControls(120);

    console.log(
      `macOS effects applied (vibrancy=${vibrancyEnabled}, shadow=${shadowEnabled}, trafficLights=${windowConfig.trafficLights}, nativeDrag=${windowConfig.nativeDragRegion})`,
    );
  } catch (error) {
    console.warn("Failed to apply native macOS effects:", error);
  }
}

function setupMacOSMenu(mainWindow: BrowserWindow) {
  ApplicationMenu.setApplicationMenu([
    {
      submenu: [{ role: "quit" }],
    },
    {
      label: "File",
      submenu: [
        {
          label: "Close Window",
          action: "close-main-window",
          accelerator: "w",
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { role: "bringAllToFront" },
      ],
    },
  ]);

  ApplicationMenu.on("application-menu-clicked", (event: unknown) => {
    const action = (event as { data?: { action?: string } })?.data?.action;
    if (action === "close-main-window") {
      mainWindow.close();
    }
  });
}

const mainWindow = new BrowserWindow({
  title: "React + Tailwind + Vite",
  url,
  frame: {
    width: 900,
    height: 700,
    x: 200,
    y: 200,
  },
  rpc: agentRPC,
  ...(isMacOS
    ? {
        titleBarStyle: wc.titleBarStyle,
        transparent: wc.transparent,
      }
    : {}),
});

// Apply macOS-specific window effects
if (isMacOS) {
  applyMacOSWindowEffects(mainWindow, wc);
  setupMacOSMenu(mainWindow);
}

// Set up application menu for all platforms
ApplicationMenu.setApplicationMenu([
  {
    submenu: [{ role: "quit" }],
  },
  {
    label: "File",
    submenu: [
      {
        label: "Close Window",
        action: "close-main-window",
        accelerator: "w",
      },
      { type: "separator" },
      { role: "quit" },
    ],
  },
  {
    label: "Window",
    submenu: [
      { role: "minimize" },
      { role: "zoom" },
      { role: "bringAllToFront" },
    ],
  },
]);

ApplicationMenu.on("application-menu-clicked", (event: unknown) => {
  const action = (event as { data?: { action?: string } })?.data?.action;
  if (action === "close-main-window") {
    mainWindow.close();
  }
});

// Quit the app when the main window is closed
mainWindow.on("close", () => {
  cleanupTray();
  Utils.quit();
});

console.log("React Tailwind Vite app started!");
