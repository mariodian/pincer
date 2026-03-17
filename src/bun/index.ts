import { BrowserWindow, Screen, Utils } from "electrobun/bun";
import { setupMainWindowMenu } from "./applicationMenu";
import { getMainViewUrl } from "./mainViewUrl";
import { systemRPC } from "./systemRPC";
import { cleanupTray, initializeTray } from "./trayManager";
import { applyMacOSWindowEffects, readWindowConfig } from "./windowService";

// Create the main application window
const url = await getMainViewUrl("index.html");
const wc = await readWindowConfig("main");
const isMacOS = process.platform === "darwin";

const windowWidth = 900;
const windowHeight = 700;
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
initializeTray();

// Combine all RPCs
const combinedRPC = {
  ...systemRPC,
};

const mainWindow = new BrowserWindow({
  title: "React + Tailwind + Vite",
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
      }
    : {}),
});

// Apply macOS-specific window effects
if (isMacOS) {
  applyMacOSWindowEffects(mainWindow, wc);
}

setupMainWindowMenu(mainWindow);

// Quit the app when the main window is closed
mainWindow.on("close", () => {
  cleanupTray();
  Utils.quit();
});

console.log("React Tailwind Vite app started!");
