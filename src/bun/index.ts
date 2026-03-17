import { BrowserWindow, Utils } from "electrobun/bun";
import { agentRPC } from "./agentRPC";
import { setupMainWindowMenu } from "./applicationMenu";
import { getMainViewUrl } from "./mainViewUrl";
import { cleanupTray, initializeTray } from "./trayManager";
import { applyMacOSWindowEffects, readWindowConfig } from "./windowService";

// Create the main application window
const url = await getMainViewUrl("index.html");
const wc = await readWindowConfig("main");
const isMacOS = process.platform === "darwin";

// Initialize tray icon
initializeTray();

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
}

setupMainWindowMenu(mainWindow);

// Quit the app when the main window is closed
mainWindow.on("close", () => {
  cleanupTray();
  Utils.quit();
});

console.log("React Tailwind Vite app started!");
