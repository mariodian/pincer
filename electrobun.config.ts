import type { ElectrobunConfig } from "electrobun";
import { appConfig } from "./src/shared/appConfig";

export default {
  app: {
    name: appConfig.name,
    identifier: appConfig.identifier,
    version: appConfig.version,
  },
  runtime: {
    exitOnLastWindowClosed: false, // keep running when all windows are closed
  },
  build: {
    // Vite builds to dist/, we copy from there
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/tray-popover.html": "views/mainview/tray-popover.html",
      "dist/assets": "views/mainview/assets",
      "src/resources": "views/resources",
      "src/bun/libs/libMacOS.dylib":
        "bun/libs/libMacOS.dylib",
      "drizzle/migrations": "drizzle/migrations",
    },
    mac: {
      bundleCEF: false,
      icons: "icons/icon.iconset",
    },
    linux: {
      bundleCEF: false,
      icon: "icons/icon.png",
    },
    win: {
      bundleCEF: false,
      icon: "icons/icon.ico",
    },
  },
  release: {
    baseUrl: "https://github.com/mariodian/pincer/releases/latest/download/",
  },
} satisfies ElectrobunConfig;
