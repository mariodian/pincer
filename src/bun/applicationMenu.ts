import { ApplicationMenu, BrowserWindow } from "electrobun/bun";

export function setupMainWindowMenu(mainWindow: BrowserWindow) {
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
