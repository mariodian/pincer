// Mocks electrobun/bun @ 1.16.0
//
// Export dependency map (source file(s) → export used):
//   PATHS                 → db.ts
//   Utils                 → statusNotifier.ts, navigation.ts, fs.ts,
//                           trayManager.ts, db.ts, macOSAutostartService.ts,
//                           loggerService.ts, autostartService.ts,
//                           trayPopoverRPC.ts, systemRPC.ts, settingsRPC.ts,
//                           index.ts
//   Updater               → url.ts, macOSAutostartService.ts, loggerService.ts,
//                           autostartService.ts, updateRPC.ts
//   BrowserWindow         → macOSWindowEffects.ts, trayManager.ts, index.ts,
//                           applicationMenu.ts
//   Tray                  → trayManager.ts
//   BrowserView           → trayPopoverRPC.ts, systemRPC.ts
//   ApplicationMenu       → applicationMenu.ts
//   Screen                → index.ts
//   Electrobun (default)  → index.ts

import { mock } from "bun:test";

export const mockShowNotification = mock(() => {});

export const PATHS = {
  VIEWS_FOLDER: "/mock/views",
};

export const Utils = {
  paths: {
    userData: "/mock/userData",
    home: "/mock/home",
    config: "/mock/config",
    downloads: "/mock/downloads",
  },
  showNotification: mockShowNotification,
  setDockIconVisible: () => {},
  quit: () => {},
  openExternal: () => true,
};

export const Updater = {
  localInfo: {
    channel: async () => "test",
    version: async () => "0.0.0",
    hash: async () => "abc123",
  },
  checkForUpdate: async () => ({ available: false }),
  downloadUpdate: async () => {},
  updateInfo: () => ({ status: "idle" }),
  applyUpdate: async () => {},
};

export class BrowserWindow {
  constructor(_opts?: unknown) {}
}

export class BrowserView {
  static defineRPC<T>(_rpc: T) {
    return {} as T;
  }
}

export class Tray {
  constructor(_opts?: unknown) {}
}

export class ApplicationMenu {
  static setApplicationMenu(_menu: unknown) {}
  static on(_event: string, _handler: (...args: unknown[]) => void) {}
}

export class Screen {
  static getAllDisplays() {
    return [{ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }];
  }
  static getPrimaryDisplay() {
    return { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } };
  }
}

const Electrobun = {
  events: {
    on(_event: string, _handler: (...args: unknown[]) => void) {},
  },
};

export default Electrobun;
