import { ApplicationMenu, BrowserWindow } from "electrobun/bun";

import { logger } from "./services/loggerService";
import { showMainWindow } from "./utils/navigation";

function requestSaveAgentForm(mainWindow: BrowserWindow): void {
  const rpc = mainWindow.webview.rpc as {
    send?: { requestSaveAgentForm?: () => void };
  } | null;

  rpc?.send?.requestSaveAgentForm?.();
}

function buildMenu(
  isFullScreen: boolean,
): Parameters<typeof ApplicationMenu.setApplicationMenu>[0] {
  return [
    {
      submenu: [
        {
          label: "About Pincer",
          action: "open-about",
        },
        { type: "separator" },
        {
          label: "Settings",
          accelerator: ",",
          action: "open-settings",
        },
        { type: "separator" },
        { label: "Quit Pincer", role: "quit", accelerator: "q" },
      ],
    },
    {
      label: "File",
      submenu: [
        {
          label: "New Agent",
          action: "new-agent",
          accelerator: "n",
        },
        { type: "separator" },
        {
          label: "Save",
          action: "save-agent-form",
          accelerator: "s",
        },
        { type: "separator" },
        {
          label: "Close Window",
          action: "close-main-window",
          accelerator: "w",
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Dashboard", action: "open-dashboard", accelerator: "d" },
        {
          label: "Agents",
          action: "open-agents",
          accelerator: "CommandOrControl+Shift+A",
        },
        { type: "separator" },
        { role: "enterFullScreen", hidden: isFullScreen },
        { role: "exitFullScreen", hidden: !isFullScreen },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "cycleThroughWindows" },
        { type: "separator" },
        { role: "bringAllToFront" },
      ],
    },
  ];
}

export function setupMainWindowMenu(mainWindow: BrowserWindow) {
  logger.debug("menu", "Setting up application menu");
  ApplicationMenu.setApplicationMenu(buildMenu(mainWindow.isFullScreen()));

  let lastFullScreen = mainWindow.isFullScreen();
  mainWindow.on("resize", () => {
    const fullScreen = mainWindow.isFullScreen();
    if (fullScreen !== lastFullScreen) {
      lastFullScreen = fullScreen;
      ApplicationMenu.setApplicationMenu(buildMenu(fullScreen));
    }
  });

  ApplicationMenu.on("application-menu-clicked", async (event: unknown) => {
    const action = (event as { data?: { action?: string } })?.data?.action;
    if (action === "close-main-window") {
      mainWindow.close();
    } else if (action === "open-about") {
      await showMainWindow("settings?tab=about");
    } else if (action === "open-settings") {
      await showMainWindow("settings");
    } else if (action === "open-dashboard") {
      await showMainWindow("dashboard");
    } else if (action === "open-agents") {
      await showMainWindow("agents");
    } else if (action === "new-agent") {
      await showMainWindow("agents/add");
    } else if (action === "save-agent-form") {
      requestSaveAgentForm(mainWindow);
    }
  });
}
